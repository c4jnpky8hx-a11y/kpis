# NOC — Inventario y migración a Proxmox VE

Herramientas para inventariar el NOC actual (Zorin OS) y planificar su migración a
Proxmox VE con failover entre dos nodos.

## Contenido

| Archivo | Qué es |
|---|---|
| `inventory.sh` | Script de inventario **de solo lectura**. Se ejecuta en la máquina del NOC. |
| `MIGRACION-PROXMOX.md` | Diseño del failover, qué hardware adquirir y el plan de migración por fases. |

## Cómo sacar el inventario

En la máquina del NOC:

```bash
# 1. Copiar el script (por SSH desde tu equipo)
scp noc/inventory.sh usuario@noc:/tmp/

# 2. Ejecutarlo allá, con sudo
ssh usuario@noc
chmod +x /tmp/inventory.sh
sudo /tmp/inventory.sh -o ~/inventario-noc

# 3. Traerte el resultado
exit
scp usuario@noc:~/inventario-noc.tar.gz .
```

Sin `sudo` también corre, pero no verá los puertos con su proceso, los discos SMART, los
contenedores Docker ni las VMs. Con `sudo` el inventario es completo.

## Qué recoge

| Sección | Contenido |
|---|---|
| 01 sistema | SO, kernel, uptime, UEFI/BIOS, Secure Boot |
| 02 hardware | CPU, **soporte VT-x/AMD-V**, RAM y sus módulos, placa, PCI, USB, sensores |
| 03 almacenamiento | Discos, particiones, LVM, mdraid, ZFS, RAID hardware, **salud SMART**, NFS/Samba |
| 04 red | Interfaces, bridges, bonds, VLANs, DNS, **puertos a la escucha**, firewall, VPN |
| 05 servicios | systemd corriendo/habilitados/fallidos, timers, units propias, top de procesos |
| 06 contenedores | Docker (contenedores, imágenes, volúmenes, redes, **compose encontrados**), LXC, k8s |
| 07 VMs | libvirt/KVM, VirtualBox, imágenes de disco |
| 08 web | nginx/apache/caddy, vhosts, **certificados y sus vencimientos**, raíces web |
| 09 bases de datos | MySQL/MariaDB, PostgreSQL, Mongo, Redis, SQLite sueltos, tamaños |
| 10 cron/usuarios | crontabs, usuarios, claves SSH, config sshd, herramientas de backup |
| 11 paquetes | Instalados, repos APT, snap/flatpak, entorno gráfico |
| 12 logs | Errores del journal, errores de disco/hardware, OOM, reinicios |

Salida:

```
inventario-noc/
├── RESUMEN.md        <- empieza por aquí; incluye la tabla de decisión a llenar
├── 01-sistema.txt
├── ...
└── 12-logs.txt
inventario-noc.tar.gz
```

## Seguridad

- El script **no instala, no modifica y no borra nada**. Solo lee y ejecuta comandos de
  consulta.
- Filtra automáticamente valores que parezcan contraseñas, tokens o claves en las salidas
  capturadas, y las credenciales embebidas en URLs (`usuario:clave@host`).
- Ese filtro es una red de seguridad, no una garantía: **revisa `RESUMEN.md` antes de
  compartirlo**. Contiene IPs internas, nombres de dominio y rutas del sistema.
