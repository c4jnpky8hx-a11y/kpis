# Migración del NOC a Proxmox VE + diseño de failover

Documento de trabajo. Parte 1 responde tu pregunta directa (¿dos instancias replicándose,
y si una cae la otra toma el control?). Parte 2 es qué comprar. Parte 3 es el plan de
migración. Parte 4 son las trampas conocidas.

El inventario real sale de `./inventory.sh` (ver `README.md` en esta carpeta) — ejecútalo
en la máquina Zorin y las tablas de la Parte 3 se llenan con datos, no con supuestos.

---

## Parte 1 — La pregunta de fondo: ¿Proxmox me da failover?

**Sí, pero con tres condiciones que casi nadie te dice al principio.** Vale la pena
entenderlas antes de comprar hardware, porque determinan *qué* comprar.

### Condición 1: dos nodos no forman un clúster. Necesitas un tercer voto.

Proxmox usa `corosync` para saber quién está vivo. Para tomar decisiones necesita
**quórum**: más de la mitad de los votos. Con dos nodos hay dos votos; si uno cae, el que
queda tiene 1 de 2 — que **no** es más de la mitad. El nodo sobreviviente se queda sin
quórum, se bloquea a sí mismo y **no arranca nada**. Es el escenario clásico de "monté el
clúster de dos nodos y cuando falló uno no pasó nada".

La solución es un **QDevice**: un tercer árbitro que solo vota, no ejecuta VMs. Es un
demonio ligerísimo (`corosync-qnetd`) que corre en cualquier Debian.

**Aquí es exactamente donde entra tu Raspberry Pi, y es un uso perfecto.** Con QDevice en
la Pi, los votos quedan 2+1: si cae un nodo, el sobreviviente tiene 2 de 3 y sí conserva
quórum, y sí arranca los servicios del caído.

> ⚠️ Corrección importante a tu plan: la Pi **no puede ser el nodo de failover**. Es ARM,
> y tus VMs son x86 — no puede ejecutarlas. Proxmox VE tampoco tiene build oficial para
> ARM (existe "Pimox", no soportado, no lo pongas en producción). La Pi es árbitro y
> orquestador de monitoreo, no respaldo de cómputo. El respaldo de cómputo tiene que ser
> un segundo x86.

### Condición 2: "replicándose" tiene dos sabores muy distintos

| | **Replicación ZFS** (`pvesr`) | **Ceph** |
|---|---|---|
| Nodos mínimos | 2 + QDevice | 3 reales (los tres con discos) |
| Cómo funciona | snapshots ZFS enviados cada N minutos | escritura síncrona a 3 copias |
| Pérdida de datos ante caída súbita | **hasta el intervalo** (mín. 1 min) | **cero** |
| Red necesaria | 1 GbE aguanta; 2.5/10 GbE mejor | 10 GbE prácticamente obligatorio |
| Complejidad | baja, se configura en la GUI en 2 minutos | media-alta, hay que entenderlo |
| Costo | 2 servidores + Pi | 3 servidores + switch 10G |

Para un NOC con webs, bases de datos internas y herramientas, **replicación ZFS cada 1–5
minutos es la respuesta correcta**. Ceph es para cuando perder 60 segundos de escrituras
es inaceptable. No es tu caso hoy — hoy no tienes *ningún* failover, así que pasar a "1
minuto de pérdida máxima" ya es un salto enorme.

### Condición 3: failover ≠ continuidad. La VM **reinicia** en el otro nodo.

Esto es lo que más confunde. Hay dos cosas distintas y Proxmox hace ambas:

- **Migración en vivo** (*live migration*) — mueves una VM encendida de un nodo a otro
  **sin cortar servicio**, ni un ping perdido. Es para mantenimiento **planeado**
  (actualizar el nodo A, moverlo todo al B, reiniciar, devolver). Requiere que la VM esté
  encendida y ambos nodos vivos.

- **HA / failover** — el nodo A **muere de golpe** (fuente, kernel panic, se fue la luz).
  El `ha-manager` lo detecta, espera el temporizador de *fencing* (watchdog, ~60 s), y
  **arranca** las VMs del nodo A en el nodo B, desde la última réplica ZFS. La VM
  **bootea**, no continúa. Es equivalente a un corte de luz de esa VM.

Traducido a tu operación:

```
Caída no planeada del nodo A:
  t=0s     nodo A muere
  t=~60s   corosync/watchdog lo declaran muerto y lo aíslan (fencing)
  t=~70s   nodo B arranca las VMs marcadas como HA
  t=~90s   servicios respondiendo de nuevo
  Pérdida de datos: lo escrito desde la última réplica (≤ intervalo configurado)
```

**Downtime real: 1,5 a 3 minutos por servicio.** Nada de "cero corte", pero comparado con
"el NOC está caído hasta que alguien lo levante a mano" es otro mundo.

Detalle práctico útil: la VM se lleva su propia IP al nodo B (es la misma VM). Mientras
los dos nodos estén en la misma red L2, **no necesitas IP flotante ni keepalived** para
que esto funcione. Un problema menos.

### Respuesta corta

> **Sí.** Dos nodos Proxmox + la Raspberry Pi como QDevice + replicación ZFS cada 1–5 min
> + `ha-manager` sobre los servicios críticos = si un nodo muere, el otro levanta esos
> servicios solo, en ~1–3 minutos, perdiendo como máximo el último intervalo de
> replicación. Para mantenimiento planeado, migración en vivo sin corte.
> La Pi es el árbitro y el monitor, no el respaldo de cómputo.

---

## Parte 2 — Qué adquirir

### Lo mínimo indispensable (el salto de "sin resiliencia" a "con failover")

| # | Qué | Por qué | Rango orientativo USD |
|---|-----|---------|----------------------|
| 1 | **Segundo servidor x86** | Es *el* requisito. Sin esto no hay failover posible. | 400–1500 según usado/nuevo |
| 2 | **Raspberry Pi 5 (8 GB) + SSD USB + fuente oficial** | QDevice (3.er voto) + monitoreo + acceso fuera de banda | 120–180 |
| 3 | **2 SSD/NVMe por nodo, iguales, en espejo ZFS** | ZFS replication exige ZFS; el espejo evita que un disco tire el nodo | 100–300 por nodo |
| 4 | **Destino de backups (PBS): mini-PC o NAS con 2 discos** | HA protege de que muera un nodo. **No** protege de borrado, ransomware ni error humano. Son problemas distintos. | 250–600 |
| 5 | **UPS con puerto USB** (+ `NUT`) | Un corte de luz cae los dos nodos a la vez. El failover no te salva de eso. | 120–300 |

### Sobre el segundo servidor: qué mirar, en orden

1. **Misma familia de CPU que el nodo actual** (los dos Intel o los dos AMD, generaciones
   cercanas). Con CPUs dispares la migración en vivo obliga a enmascarar instrucciones al
   mínimo común y pierdes rendimiento. Si son iguales, mejor todavía.
2. **RAM ≥ la del nodo actual.** El nodo sobreviviente tiene que aguantar *toda* la carga,
   no la mitad. Si hoy usas 48 GB, el nodo B necesita 48 GB libres — no 24.
   **ECC si el presupuesto lo permite**; ZFS y ECC se llevan bien y detectan corrupción
   silenciosa.
3. **Discos en HBA / modo IT, no en RAID hardware.** ZFS necesita ver los discos crudos.
   Una controladora RAID por encima de ZFS es contraproducente y peligrosa.
4. **Mínimo 2 NIC, idealmente 3:** una para gestión+servicios, **una dedicada solo a
   corosync** (es sensible a latencia; si compite con tráfico de replicación empieza a
   declarar nodos muertos que están vivos), y una para la replicación ZFS.
5. Presupuesto ajustado: un mini-PC tipo Ryzen 7 / N100 con 32–64 GB y dos NVMe cumple
   perfectamente para un NOC pequeño y consume 15–25 W.

### Qué NO comprar

- ❌ **Una segunda Raspberry Pi como nodo.** ARM, no ejecuta tus VMs x86.
- ❌ **Un NAS como "almacenamiento compartido" para las VMs**, salvo que el NAS mismo sea
  redundante. Si las dos VMs leen del mismo NAS, ese NAS **es** tu punto único de fallo —
  cambiaste el problema de sitio, no lo resolviste. La replicación ZFS local en cada nodo
  evita esto por diseño.
- ❌ Licencias Proxmox el día uno. El repo *no-subscription* funciona igual; la
  suscripción compra soporte y el repo enterprise, no funcionalidad. Se puede añadir
  después si el NOC se vuelve crítico para terceros.

### El rol correcto de la Raspberry Pi

Tu instinto de usarla como "orquestador" es bueno, solo hay que ubicarla bien: es la pieza
que **queda viva y mirando cuando todo lo demás se cae**. Debe estar en un enchufe
distinto y, si puede ser, con la red por otro camino.

| Rol | Software |
|-----|----------|
| **3.er voto del clúster** | `corosync-qnetd` (esto es lo estructural) |
| Monitoreo / alertas | Uptime Kuma (simple) o Zabbix / Prometheus+Grafana (completo) |
| Acceso fuera de banda | WireGuard o Tailscale — entrar al NOC aunque los nodos estén caídos |
| Notificaciones | ntfy / Gotify / a Telegram |
| DNS interno | Pi-hole o Unbound (ojo: si es el único DNS, se vuelve punto único de fallo) |

No pongas Proxmox Backup Server en la Pi: no hay build oficial ARM y el destino de
backups no es sitio para experimentos.

---

## Parte 3 — Plan de migración

### Fase 0 — Inventario y red de seguridad (antes de tocar nada)

1. Ejecutar `sudo ./inventory.sh` en la máquina Zorin.
2. Llenar la tabla de decisión de `RESUMEN.md`: servicio → puertos → destino → ¿crítico?
3. **Imagen completa del disco actual** (Clonezilla a un disco externo). Es el botón de
   deshacer. No se salta este paso.
4. Backup de datos verificado y **restaurado en otra parte** — un backup no probado no es
   un backup.
5. Anotar registros DNS, certificados y sus vencimientos, y las IP públicas/NAT.

### Fase 1 — Levantar el nodo nuevo primero (no el viejo)

Instala Proxmox VE en el **hardware nuevo**, no en el Zorin. Así el NOC actual sigue en
producción mientras construyes al lado, y la migración se hace servicio por servicio, con
rollback en cada paso.

> ⚠️ **Proxmox no se instala "encima" de Zorin.** Proxmox VE es Debian; Zorin es Ubuntu.
> Los paquetes de PVE sobre Ubuntu no están soportados y rompen cosas de formas creativas.
> Es **instalación limpia**, sí o sí. Por eso la imagen de la Fase 0 importa tanto.

- Instalar con `zfs (RAID1)` sobre los dos discos desde el instalador.
- Cambiar al repo `pve-no-subscription`.
- Red: bridge `vmbr0` para servicios; NIC aparte reservada para corosync.

### Fase 2 — Mover servicios, del más fácil al más difícil

Criterio LXC vs VM:

| Tipo de carga | Destino | Nota |
|---|---|---|
| Sitios web estáticos, nginx, reverse proxy | **LXC** | Arranca en 2 s, ~100 MB RAM |
| PostgreSQL / MySQL | **LXC** | Volcado y restauración; que el dato viva en un dataset ZFS propio |
| Apps Node / Python / PHP | **LXC** | |
| **Todo lo que hoy es Docker** | **VM** (Debian + Docker) | Docker en LXC *funciona* pero pide unprivileged+nesting y da problemas raros. Una VM es más limpia y se migra en vivo sin drama. |
| Firewall / OPNsense / pfSense | **VM** | |
| Windows, o cualquier cosa con kernel propio | **VM** | |

Orden sugerido: **primero el servicio menos crítico** (para aprender el flujo con algo
que puede caerse), luego webs, luego bases de datos, y el servicio más crítico **al
final**, ya con el procedimiento dominado.

Para cada servicio: crear el contenedor/VM → instalar → migrar datos → probar contra la
IP nueva → cambiar DNS/proxy → dejar el viejo apagado pero **sin borrar** una semana.

### Fase 3 — Reciclar el Zorin como nodo 2

Cuando el NOC ya viva en el nodo nuevo y esté estable (mínimo una semana), **el hardware
actual se formatea con Proxmox y entra al clúster como segundo nodo**. Esto puede
abaratarte mucho la Parte 2: quizá no compres dos servidores, sino uno.

### Fase 4 — Clúster, QDevice y HA

```bash
# En el nodo 1
pvecm create noc-cluster
# En el nodo 2
pvecm add <ip-nodo-1>

# QDevice en la Raspberry Pi (Debian/RaspberryPi OS)
apt install corosync-qnetd
# Desde cualquier nodo Proxmox:
apt install corosync-qdevice
pvecm qdevice setup <ip-de-la-pi>

pvecm status        # debe mostrar 3 votos y "Quorate: Yes"
```

Replicación (GUI: *VM → Replication → Add*, o CLI):

```bash
pvesr create-local-job 101-0 nodo2 --schedule "*/5"    # cada 5 min
pvesr create-local-job 102-0 nodo2 --schedule "*/1"    # crítico: cada minuto
```

HA (GUI: *Datacenter → HA*):

```bash
ha-manager add vm:101 --state started --max_restart 2 --max_relocate 1
```

### Fase 5 — Probarlo de verdad

Un failover que no se ha probado no existe. Con carga real y un cronómetro:

1. **Corta la corriente al nodo 1 de golpe** (no `shutdown` — desenchúfalo).
2. Cronometra hasta que el servicio responda en el nodo 2.
3. Verifica **cuántos datos se perdieron** y contrástalo con el intervalo de replicación.
4. Devuelve el nodo 1 y comprueba que la replicación se reinvierte correctamente.
5. Repite con: nodo 2 caído, la Pi caída (debe seguir funcionando todo), y el enlace de
   red de corosync cortado (el caso feo — el *split-brain*).
6. Documenta los tiempos medidos. Eso es tu RTO real, no el del folleto.

---

## Parte 4 — Trampas conocidas

| Trampa | Cómo evitarla |
|---|---|
| **HA no es backup.** Replica fielmente el `rm -rf` y el ransomware. | Proxmox Backup Server en hardware separado. Regla 3-2-1. |
| **Corosync compartiendo NIC con la replicación.** Bajo carga la latencia se dispara y el clúster declara nodos muertos que están vivos. | NIC dedicada a corosync. Idealmente dos anillos (`link0`/`link1`). |
| **El nodo sobreviviente no aguanta la carga total.** Failover que arranca las VMs y muere por OOM. | Dimensiona cada nodo al 100 % de la carga, no al 50 %. Techo de uso normal: ~50–60 % de RAM por nodo. |
| **Los dos nodos en el mismo UPS / el mismo enchufe / el mismo switch.** | Enchufes distintos, idealmente circuitos distintos. Switch: al menos que corosync y servicios no dependan del mismo. |
| **ZFS sin RAM suficiente.** El ARC se come la memoria y compite con las VMs. | ~1 GB de RAM por TB útil, y limitar el ARC (`zfs_arc_max`) dejando margen a las VMs. |
| **Contenedores LXC no migran en vivo** (sí hacen failover, con reinicio). | Si un servicio necesita moverse sin corte para mantenimiento, ponlo en VM. |
| **Certificados y DNS olvidados.** El servicio arranca en el nodo 2 y falla el TLS. | Certificados dentro de la VM/LXC (viajan con ella), no en el hipervisor. Anota TTLs de DNS. |
| **Split-brain.** Se corta la red entre nodos y ambos creen ser el bueno. | El QDevice lo resuelve: el que hable con la Pi conserva quórum. Colócala en un camino de red distinto al enlace entre nodos. |
| **Probar el failover solo el día del incidente.** | Fase 5. Y repetirla cada 6 meses. |

---

## Estado

- [x] Script de inventario listo (`inventory.sh`)
- [ ] Inventario ejecutado en la máquina Zorin → pegar `RESUMEN.md`
- [ ] Tabla de decisión servicio→destino completada
- [ ] Hardware definido y comprado
- [ ] Fase 1 — nodo nuevo instalado
- [ ] Fase 2 — servicios migrados
- [ ] Fase 3 — Zorin reciclado como nodo 2
- [ ] Fase 4 — clúster + QDevice + HA
- [ ] Fase 5 — failover probado con corte real y tiempos documentados
