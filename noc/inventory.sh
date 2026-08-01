#!/usr/bin/env bash
# =============================================================================
#  inventory.sh - Inventario completo de un host antes de migrar a Proxmox VE
# =============================================================================
#  SOLO LECTURA. No instala, no modifica, no borra nada.
#
#  Uso:
#     chmod +x inventory.sh
#     sudo ./inventory.sh                 # recomendado (ve puertos, discos, VMs)
#     ./inventory.sh                      # funciona sin root, con menos detalle
#     sudo ./inventory.sh -o /ruta/salida # cambiar directorio de salida
#
#  Genera:
#     ./noc-inventory-<host>-<fecha>/          <- un .txt por cada sección
#     ./noc-inventory-<host>-<fecha>/RESUMEN.md
#     ./noc-inventory-<host>-<fecha>.tar.gz    <- para compartir
#
#  Revisa RESUMEN.md antes de compartirlo: puede contener nombres de dominio,
#  IPs internas y rutas. El script ya intenta ocultar contraseñas y tokens
#  (ver funcion scrub), pero la revision final es tuya.
# =============================================================================

set -uo pipefail

OUTDIR=""
while getopts ":o:h" opt; do
  case "$opt" in
    o) OUTDIR="$OPTARG" ;;
    h) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Opcion invalida. Usa -h"; exit 1 ;;
  esac
done

HOST="$(hostname -s 2>/dev/null || echo host)"
STAMP="$(date +%Y%m%d-%H%M)"
[ -n "$OUTDIR" ] || OUTDIR="./noc-inventory-${HOST}-${STAMP}"
mkdir -p "$OUTDIR" || { echo "No pude crear $OUTDIR"; exit 1; }
OUTDIR="$(cd "$OUTDIR" && pwd)"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; ROOT=yes; else SUDO="sudo -n"; ROOT=no; fi

have() { command -v "$1" >/dev/null 2>&1; }

# Lee stdin y, si no hay nada, imprime un marcador en vez de dejar el bloque vacio.
orelse() {
  local out; out="$(cat)"
  if [ -n "${out//[[:space:]]/}" ]; then echo "$out"; else echo "  [nada detectado / herramienta no disponible]"; fi
}

# Oculta valores que parezcan secretos en cualquier salida capturada.
scrub() {
  sed -E \
    -e 's/(PASS(WORD)?|PWD|SECRET|TOKEN|API_?KEY|PRIVATE_KEY|ACCESS_KEY|AUTH)([A-Z_]*)([=:][[:space:]]*)[^[:space:]"'"'"']+/\1\3\4<REDACTADO>/gI' \
    -e 's#(://[^:/@[:space:]]+):[^@[:space:]]+@#\1:<REDACTADO>@#g'
}

# run <archivo> <titulo> <comando...>
run() {
  local file="$1"; shift
  local title="$1"; shift
  {
    echo "### $title"
    echo "\$ $*"
    echo "---"
    if have "${1}"; then
      "$@" 2>&1 | scrub
    else
      echo "[no disponible: '${1}' no esta instalado]"
    fi
    echo
  } >> "$OUTDIR/$file"
}

# runsh <archivo> <titulo> <shell string>   (para pipes / redirecciones)
runsh() {
  local file="$1"; shift
  local title="$1"; shift
  {
    echo "### $title"
    echo "\$ $*"
    echo "---"
    bash -c "$*" 2>&1 | scrub
    echo
  } >> "$OUTDIR/$file"
}

say() { printf '  \033[0;36m>\033[0m %s\n' "$*"; }

echo
echo "==============================================="
echo " Inventario NOC - $HOST - $(date)"
echo " Salida: $OUTDIR"
[ "$ROOT" = yes ] || echo " AVISO: sin root. Ejecuta con sudo para el inventario completo."
echo "==============================================="
echo

# -----------------------------------------------------------------------------
say "01 - Sistema operativo y kernel"
F=01-sistema.txt
run  $F "Release"            cat /etc/os-release
run  $F "LSB"                lsb_release -a
run  $F "Kernel"             uname -a
runsh $F "Uptime / carga"    "uptime; echo; who -b"
run  $F "Hostname completo"  hostnamectl
runsh $F "Zona horaria"      "timedatectl 2>/dev/null || date"
runsh $F "Arranque UEFI/BIOS" "[ -d /sys/firmware/efi ] && echo 'Arranque: UEFI' || echo 'Arranque: BIOS/Legacy'"
runsh $F "Secure Boot"       "mokutil --sb-state 2>/dev/null || echo '[mokutil no instalado]'"

# -----------------------------------------------------------------------------
say "02 - Hardware, CPU y virtualizacion"
F=02-hardware.txt
run  $F "CPU"                lscpu
runsh $F "Soporte VT-x / AMD-V" "grep -oE 'vmx|svm' /proc/cpuinfo | sort -u | sed 's/vmx/Intel VT-x: SI/;s/svm/AMD-V: SI/' | grep . || echo 'NO se detecto VT-x/AMD-V -> revisar BIOS. Sin esto no hay KVM.'"
runsh $F "IOMMU activo"      "dmesg 2>/dev/null | grep -iE 'DMAR|IOMMU' | head -20 || echo '[sin acceso a dmesg]'"
runsh $F "Nested / KVM"      "ls -l /dev/kvm 2>/dev/null || echo '/dev/kvm no existe'"
run  $F "Memoria"            free -h
runsh $F "Modulos de RAM"    "$SUDO dmidecode -t memory 2>/dev/null | grep -E 'Size|Speed|Type:|Locator|Manufacturer' || echo '[requiere root/dmidecode]'"
runsh $F "Placa y chasis"    "$SUDO dmidecode -t system -t baseboard -t chassis 2>/dev/null || echo '[requiere root/dmidecode]'"
runsh $F "Slots PCI ocupados" "$SUDO dmidecode -t slot 2>/dev/null | grep -E 'Designation|Current Usage|Type' || echo '[requiere root/dmidecode]'"
run  $F "Dispositivos PCI"   lspci -nnk
run  $F "Dispositivos USB"   lsusb
run  $F "Sensores"           sensors
runsh $F "Virtualizado?"     "systemd-detect-virt 2>/dev/null || echo desconocido"

# -----------------------------------------------------------------------------
say "03 - Almacenamiento (critico para planear ZFS/Ceph)"
F=03-almacenamiento.txt
run  $F "Bloques"            lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL,SERIAL,ROTA,TRAN
run  $F "Uso de disco"       df -hT
run  $F "Montajes"           findmnt -A
runsh $F "fstab"             "cat /etc/fstab"
runsh $F "Swap"              "swapon --show; echo; cat /proc/swaps"
run  $F "Particiones"        cat /proc/partitions
runsh $F "LVM"               "$SUDO pvs 2>/dev/null; $SUDO vgs 2>/dev/null; $SUDO lvs 2>/dev/null || echo '[sin LVM o requiere root]'"
runsh $F "RAID por software" "cat /proc/mdstat 2>/dev/null; $SUDO mdadm --detail --scan 2>/dev/null || echo '[sin mdraid]'"
runsh $F "ZFS"               "zpool status 2>/dev/null; zpool list 2>/dev/null; zfs list 2>/dev/null || echo '[sin ZFS]'"
runsh $F "BTRFS"             "btrfs filesystem show 2>/dev/null || echo '[sin btrfs]'"
runsh $F "RAID hardware"     "$SUDO storcli64 /c0 show 2>/dev/null || $SUDO megacli -LDInfo -Lall -aALL 2>/dev/null || $SUDO ssacli ctrl all show config 2>/dev/null || echo '[sin controladora RAID detectada o sin herramienta]'"
runsh $F "SMART por disco"   'for d in $(lsblk -dno NAME,TYPE | awk "\$2==\"disk\"{print \$1}"); do echo "===== /dev/$d ====="; '"$SUDO"' smartctl -i -H -A /dev/$d 2>/dev/null | grep -iE "Model|Serial|Capacity|Rotation|health|Power_On_Hours|Reallocated|Wear|Percentage_Used|Total_LBAs" || echo "[smartctl no disponible]"; done'
runsh $F "NFS/CIFS exportados" "cat /etc/exports 2>/dev/null; exportfs -v 2>/dev/null; testparm -s 2>/dev/null | head -60 || echo '[sin NFS/Samba]'"

# -----------------------------------------------------------------------------
say "04 - Red"
F=04-red.txt
run  $F "Interfaces"         ip -d addr
run  $F "Rutas"              ip route
run  $F "Rutas v6"           ip -6 route
runsh $F "Bridges / bonds"   "$SUDO brctl show 2>/dev/null; ip -d link show type bridge 2>/dev/null; ip -d link show type bond 2>/dev/null; cat /proc/net/bonding/* 2>/dev/null"
runsh $F "VLANs"             "ip -d link show type vlan 2>/dev/null || echo '[sin VLANs]'"
runsh $F "Config de red"     "cat /etc/network/interfaces 2>/dev/null; ls -1 /etc/netplan/ 2>/dev/null && cat /etc/netplan/*.yaml 2>/dev/null; nmcli -t connection show 2>/dev/null"
runsh $F "DNS"               "resolvectl status 2>/dev/null | head -40; cat /etc/resolv.conf"
runsh $F "Hosts"             "cat /etc/hosts"
runsh $F "Puertos a la escucha" "$SUDO ss -tulpnH 2>/dev/null | sort -k5 || ss -tulpn"
runsh $F "Firewall ufw"      "$SUDO ufw status verbose 2>/dev/null || echo '[ufw no activo]'"
runsh $F "Firewall nft/ipt"  "$SUDO nft list ruleset 2>/dev/null | head -120; $SUDO iptables -S 2>/dev/null | head -80"
runsh $F "fail2ban"          "$SUDO fail2ban-client status 2>/dev/null || echo '[sin fail2ban]'"
runsh $F "VPN"               "$SUDO wg show 2>/dev/null; tailscale status 2>/dev/null; ls -1 /etc/openvpn 2>/dev/null || echo '[sin VPN detectada]'"
runsh $F "IP publica de salida" "curl -s --max-time 6 ifconfig.me 2>/dev/null || echo '[sin salida a internet o curl ausente]'"

# -----------------------------------------------------------------------------
say "05 - Servicios systemd (que hay corriendo)"
F=05-servicios.txt
runsh $F "Servicios activos"   "systemctl list-units --type=service --state=running --no-pager --plain"
runsh $F "Habilitados al boot" "systemctl list-unit-files --type=service --state=enabled --no-pager --plain"
runsh $F "Servicios fallidos"  "systemctl --failed --no-pager --plain"
runsh $F "Timers"              "systemctl list-timers --all --no-pager"
runsh $F "Units personalizadas (/etc/systemd/system)" "ls -la /etc/systemd/system/*.service 2>/dev/null; echo; for u in /etc/systemd/system/*.service; do [ -f \"\$u\" ] || continue; echo \"===== \$u =====\"; cat \"\$u\"; echo; done"
runsh $F "Top 25 procesos por RAM" "ps -eo pid,ppid,user,%cpu,%mem,rss,etime,cmd --sort=-rss | head -26"
runsh $F "Top 25 procesos por CPU" "ps -eo pid,ppid,user,%cpu,%mem,rss,etime,cmd --sort=-%cpu | head -26"

# -----------------------------------------------------------------------------
say "06 - Docker / contenedores"
F=06-docker.txt
if have docker; then
  runsh $F "Version / info"      "$SUDO docker version 2>&1 | head -20; echo; $SUDO docker info 2>&1 | head -40"
  runsh $F "Contenedores"        "$SUDO docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
  runsh $F "Imagenes"            "$SUDO docker images"
  runsh $F "Volumenes"           "$SUDO docker volume ls; echo; $SUDO docker system df -v 2>/dev/null | head -80"
  runsh $F "Redes"               "$SUDO docker network ls"
  runsh $F "Politica de reinicio y montajes por contenedor" \
        "for c in \$($SUDO docker ps -aq); do echo \"===== \$c =====\"; $SUDO docker inspect \$c --format 'Nombre: {{.Name}}
Imagen: {{.Config.Image}}
Reinicio: {{.HostConfig.RestartPolicy.Name}}
Puertos: {{json .HostConfig.PortBindings}}
Volumenes: {{json .Mounts}}
Red: {{json .NetworkSettings.Networks}}' 2>/dev/null; echo; done"
  runsh $F "docker-compose encontrados" \
        "find / -xdev \\( -name 'docker-compose*.y*ml' -o -name 'compose.y*ml' \\) -not -path '*/node_modules/*' 2>/dev/null | head -50"
  runsh $F "Contenido de los compose" \
        "for f in \$(find / -xdev \\( -name 'docker-compose*.y*ml' -o -name 'compose.y*ml' \\) -not -path '*/node_modules/*' 2>/dev/null | head -20); do echo \"===== \$f =====\"; cat \"\$f\"; echo; done"
else
  echo "[docker no instalado]" > "$OUTDIR/$F"
fi
runsh $F "Podman"  "podman ps -a 2>/dev/null || echo '[sin podman]'"
runsh $F "LXC/LXD" "lxc list 2>/dev/null; $SUDO lxc-ls -f 2>/dev/null || echo '[sin LXC/LXD]'"
runsh $F "K8s/k3s"  "kubectl get nodes 2>/dev/null; kubectl get pods -A 2>/dev/null; systemctl is-active k3s 2>/dev/null || echo '[sin kubernetes]'"

# -----------------------------------------------------------------------------
say "07 - Maquinas virtuales existentes (KVM/libvirt/VirtualBox)"
F=07-vms.txt
runsh $F "libvirt - lista"    "$SUDO virsh list --all 2>/dev/null || echo '[sin libvirt]'"
runsh $F "libvirt - detalle"  "for v in \$($SUDO virsh list --all --name 2>/dev/null); do [ -n \"\$v\" ] || continue; echo \"===== \$v =====\"; $SUDO virsh dominfo \"\$v\" 2>/dev/null; $SUDO virsh domblklist \"\$v\" 2>/dev/null; $SUDO virsh domiflist \"\$v\" 2>/dev/null; echo; done"
runsh $F "libvirt - redes y pools" "$SUDO virsh net-list --all 2>/dev/null; $SUDO virsh pool-list --all 2>/dev/null"
runsh $F "Imagenes de disco"  "ls -lah /var/lib/libvirt/images/ 2>/dev/null; find / -xdev \\( -name '*.qcow2' -o -name '*.vmdk' -o -name '*.vdi' -o -name '*.vhdx' \\) -size +100M 2>/dev/null | head -40"
runsh $F "VirtualBox"         "VBoxManage list vms 2>/dev/null; VBoxManage list runningvms 2>/dev/null || echo '[sin VirtualBox]'"

# -----------------------------------------------------------------------------
say "08 - Web: nginx / apache / certificados"
F=08-web.txt
runsh $F "nginx activo"       "systemctl is-active nginx 2>/dev/null; nginx -v 2>&1; $SUDO nginx -T 2>/dev/null | grep -E 'server_name|listen|root|proxy_pass|ssl_certificate |include' | head -150"
runsh $F "nginx sites-enabled" "ls -la /etc/nginx/sites-enabled/ 2>/dev/null; for f in /etc/nginx/sites-enabled/*; do [ -f \"\$f\" ] || continue; echo \"===== \$f =====\"; cat \"\$f\"; echo; done"
runsh $F "apache"             "systemctl is-active apache2 2>/dev/null; apache2ctl -S 2>/dev/null; ls -la /etc/apache2/sites-enabled/ 2>/dev/null"
runsh $F "caddy / traefik"    "systemctl is-active caddy 2>/dev/null; cat /etc/caddy/Caddyfile 2>/dev/null | head -60; ls -la /etc/traefik 2>/dev/null"
runsh $F "Certificados Let's Encrypt" "$SUDO certbot certificates 2>/dev/null || $SUDO ls -la /etc/letsencrypt/live/ 2>/dev/null || echo '[sin certbot]'"
runsh $F "Vencimiento de certs" "for c in \$($SUDO find /etc/letsencrypt/live /etc/ssl/certs -name 'fullchain.pem' -o -name '*.crt' 2>/dev/null | head -20); do echo -n \"\$c -> \"; $SUDO openssl x509 -noout -enddate -subject -in \"\$c\" 2>/dev/null | tr '\n' ' '; echo; done"
runsh $F "Raices web"         "ls -la /var/www/ 2>/dev/null; ls -la /srv/ 2>/dev/null"
runsh $F "PHP / node / python" "php -v 2>/dev/null | head -2; node -v 2>/dev/null; npm -v 2>/dev/null; python3 -V 2>/dev/null; pm2 list 2>/dev/null"

# -----------------------------------------------------------------------------
say "09 - Bases de datos"
F=09-bases-datos.txt
runsh $F "MySQL/MariaDB"  "systemctl is-active mysql mariadb 2>/dev/null; mysql --version 2>/dev/null; $SUDO mysql -e 'SHOW DATABASES;' 2>/dev/null || echo '[no accesible sin credenciales - listar manualmente]'; $SUDO du -sh /var/lib/mysql 2>/dev/null"
runsh $F "PostgreSQL"     "systemctl is-active postgresql 2>/dev/null; psql --version 2>/dev/null; $SUDO -u postgres psql -c '\l+' 2>/dev/null || echo '[no accesible]'; $SUDO du -sh /var/lib/postgresql 2>/dev/null"
runsh $F "MongoDB"        "systemctl is-active mongod 2>/dev/null; mongosh --quiet --eval 'db.adminCommand({listDatabases:1})' 2>/dev/null || echo '[sin mongo o no accesible]'"
runsh $F "Redis"          "systemctl is-active redis redis-server 2>/dev/null; redis-cli INFO server 2>/dev/null | head -10"
runsh $F "SQLite sueltos" "find / -xdev \\( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \\) -size +1M -not -path '*/node_modules/*' 2>/dev/null | head -30"

# -----------------------------------------------------------------------------
say "10 - Tareas programadas, usuarios y backups"
F=10-cron-usuarios.txt
runsh $F "crontab de root"   "$SUDO crontab -l 2>/dev/null || echo '[vacio]'"
runsh $F "crontabs de usuarios" "for u in \$(cut -d: -f1 /etc/passwd); do c=\$($SUDO crontab -u \$u -l 2>/dev/null); [ -n \"\$c\" ] && { echo \"===== \$u =====\"; echo \"\$c\"; }; done"
runsh $F "cron del sistema"  "cat /etc/crontab 2>/dev/null; ls -la /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/ 2>/dev/null"
runsh $F "Usuarios con shell" "awk -F: '\$3>=1000 && \$7 !~ /nologin|false/ {print \$1\" uid=\"\$3\" home=\"\$6\" shell=\"\$7}' /etc/passwd"
runsh $F "Grupos sudo/docker" "getent group sudo docker adm libvirt kvm 2>/dev/null"
runsh $F "Claves SSH autorizadas" "for h in /root /home/*; do [ -f \"\$h/.ssh/authorized_keys\" ] && { echo \"===== \$h =====\"; $SUDO awk '{print \$1, \$NF}' \"\$h/.ssh/authorized_keys\"; }; done 2>/dev/null"
runsh $F "Config SSHD"       "$SUDO sshd -T 2>/dev/null | grep -E 'port|permitrootlogin|passwordauthentication|pubkeyauthentication|allowusers' || grep -vE '^#|^$' /etc/ssh/sshd_config 2>/dev/null"
runsh $F "Herramientas de backup" "systemctl is-active restic borgbackup duplicati veeam 2>/dev/null; which restic borg rsnapshot duplicity rclone 2>/dev/null; ls -la /etc/restic /etc/borgmatic 2>/dev/null || echo '[sin backup automatizado detectado]'"

# -----------------------------------------------------------------------------
say "11 - Paquetes y repositorios"
F=11-paquetes.txt
runsh $F "Paquetes instalados (conteo)" "dpkg -l 2>/dev/null | grep -c '^ii' || rpm -qa | wc -l"
runsh $F "Paquetes manuales"  "apt-mark showmanual 2>/dev/null | head -200"
runsh $F "Repositorios APT"   "cat /etc/apt/sources.list 2>/dev/null; ls -1 /etc/apt/sources.list.d/ 2>/dev/null; cat /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources 2>/dev/null"
runsh $F "Snap / Flatpak"     "snap list 2>/dev/null; flatpak list 2>/dev/null"
runsh $F "Entorno grafico"    "echo \"Target por defecto: \$(systemctl get-default 2>/dev/null)\"; systemctl is-active gdm gdm3 sddm lightdm 2>/dev/null; echo \"XDG_CURRENT_DESKTOP=\${XDG_CURRENT_DESKTOP:-<no definido>}\""

# -----------------------------------------------------------------------------
say "12 - Logs y salud"
F=12-logs.txt
runsh $F "Errores recientes del journal" "$SUDO journalctl -p 3 -b --no-pager 2>/dev/null | tail -60 || echo '[sin acceso al journal]'"
runsh $F "Errores de hardware/disco"     "$SUDO dmesg -T 2>/dev/null | grep -iE 'error|fail|I/O|ata[0-9]|nvme|oom|thermal' | tail -60 || echo '[sin acceso a dmesg]'"
runsh $F "OOM killer"                    "$SUDO journalctl --no-pager 2>/dev/null | grep -i 'out of memory' | tail -20 || echo '[nada]'"
runsh $F "Reinicios recientes"           "last -x reboot 2>/dev/null | head -15"

# =============================================================================
say "Generando RESUMEN.md"
# =============================================================================
SUM="$OUTDIR/RESUMEN.md"
{
  echo "# Inventario NOC — \`$HOST\`"
  echo
  echo "- Fecha: $(date)"
  echo "- Ejecutado como root: $ROOT"
  echo "- Directorio: \`$OUTDIR\`"
  echo
  echo "## 1. Sistema"
  echo '```'
  grep -E '^(PRETTY_NAME|VERSION_ID)=' /etc/os-release 2>/dev/null
  echo "Kernel: $(uname -r)  Arch: $(uname -m)"
  echo "Uptime: $(uptime -p 2>/dev/null)"
  echo "Arranque: $([ -d /sys/firmware/efi ] && echo UEFI || echo BIOS/Legacy)"
  echo '```'
  echo
  echo "## 2. Hardware"
  echo '```'
  lscpu 2>/dev/null | grep -E '^(Model name|Socket|Core\(s\)|Thread|CPU\(s\)):' | sed 's/  */ /g'
  echo "Virtualizacion HW: $(grep -qE 'vmx|svm' /proc/cpuinfo && echo 'SI (KVM disponible)' || echo 'NO DETECTADA — revisar BIOS')"
  free -h 2>/dev/null | awk '/Mem:/{print "RAM total: "$2"   usada: "$3"   libre: "$4}'
  echo "Discos:"
  lsblk -dno NAME,SIZE,MODEL,ROTA 2>/dev/null | awk '{t=($NF=="1")?"HDD":"SSD/NVMe"; $NF=""; print "  - /dev/"$0" ("t")"}'
  echo '```'
  echo
  echo "## 3. Almacenamiento montado"
  echo '```'
  df -hT 2>/dev/null | grep -vE 'tmpfs|udev|squashfs'
  echo '```'
  echo
  echo "## 4. Direcciones IP"
  echo '```'
  { ip -4 -br addr 2>/dev/null | grep -v '^lo'
    ip route 2>/dev/null | awk '/default/{print "Gateway: "$3" via "$5}'; } | orelse
  echo '```'
  echo
  echo "## 5. Servicios systemd corriendo"
  echo '```'
  systemctl list-units --type=service --state=running --no-pager --plain 2>/dev/null \
    | awk '{print $1}' | grep '\.service$' | sed 's/^/  /' | orelse
  echo '```'
  echo
  echo "## 6. Puertos a la escucha (que expone esta maquina)"
  echo '```'
  { $SUDO ss -tulpnH 2>/dev/null || ss -tulpnH 2>/dev/null; } \
    | awk '{split($5,a,":"); port=a[length(a)]; proc=$7; gsub(/users:|\(|\)|"/,"",proc); print $1"\t"port"\t"$5"\t"proc}' \
    | sort -u -k2 -n | sed 's/^/  /' | orelse
  echo '```'
  echo
  echo "## 7. Contenedores Docker"
  echo '```'
  if have docker; then
    $SUDO docker ps -a --format '  {{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}' 2>/dev/null || echo "  [docker presente pero sin permisos: reejecuta con sudo]"
  else
    echo "  [docker no instalado]"
  fi
  echo '```'
  echo
  echo "## 8. Maquinas virtuales existentes"
  echo '```'
  $SUDO virsh list --all 2>/dev/null | sed 's/^/  /' || echo "  [sin libvirt]"
  echo '```'
  echo
  echo "## 9. Sitios web publicados"
  echo '```'
  { $SUDO nginx -T 2>/dev/null | grep -E '^\s*server_name' | tr -s ' ' | sort -u | sed 's/^/  nginx: /'
    $SUDO apache2ctl -S 2>/dev/null | grep -E 'namevhost' | sed 's/^/  apache: /'; } 2>/dev/null | orelse
  echo '```'
  echo
  echo "## 10. Bases de datos"
  echo '```'
  { for s in mysql mariadb postgresql mongod redis-server redis; do
      [ "$(systemctl is-active "$s" 2>/dev/null)" = "active" ] && echo "  $s: ACTIVO"
    done; } | orelse
  echo '```'
  echo
  echo "---"
  echo
  echo "## Checklist de decision para la migracion"
  echo
  echo "Completar a mano tras revisar los .txt de este directorio:"
  echo
  echo "| # | Servicio / sitio | Puerto(s) | Donde vive hoy | Destino Proxmox | Critico (HA si/no) | Datos que hay que migrar |"
  echo "|---|------------------|-----------|----------------|-----------------|--------------------|--------------------------|"
  echo "| 1 |                  |           |                | LXC / VM        |                    |                          |"
  echo "| 2 |                  |           |                | LXC / VM        |                    |                          |"
  echo "| 3 |                  |           |                | LXC / VM        |                    |                          |"
  echo
  echo "Criterio rapido LXC vs VM:"
  echo "- **LXC**: web estatica, nginx, PostgreSQL/MySQL, apps Node/Python, Uptime Kuma, herramientas internas. Menos RAM, arranca en segundos."
  echo "- **VM**: cualquier cosa con Docker (soportado y limpio), firewalls (OPNsense/pfSense), Windows, kernels propios, o algo que quieras poder mover en vivo (live migration) sin sorpresas."
} > "$SUM"

# -----------------------------------------------------------------------------
TARBALL="${OUTDIR}.tar.gz"
tar czf "$TARBALL" -C "$(dirname "$OUTDIR")" "$(basename "$OUTDIR")" 2>/dev/null && \
  say "Empaquetado: $TARBALL"

echo
echo "==============================================="
echo " LISTO"
echo "==============================================="
echo "  Resumen legible : $SUM"
echo "  Detalle completo: $OUTDIR/*.txt"
echo "  Para compartir  : $TARBALL"
echo
echo "  Revisa el resumen antes de compartirlo (IPs, dominios, rutas)."
echo
