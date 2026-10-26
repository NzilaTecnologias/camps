#!/bin/sh
# Cópia de segurança diária do Postgres (formato custom do pg_dump, comprimido) e das imagens
# carregadas (/uploads, num .tar.gz) para /backups, à hora BACKUP_HOUR de Luanda, guardando os
# últimos BACKUP_KEEP_DAYS dias.
# Restaurar: ver docs/PRODUCAO.md ("Restaurar uma cópia").
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
HOUR="${BACKUP_HOUR:-3}"

backup() {
  file="/backups/camps-$(date +%Y%m%d-%H%M%S).dump"
  echo "backup: a criar $file"
  if pg_dump --format=custom --compress=9 --file="$file.part"; then
    mv "$file.part" "$file"
    echo "backup: pronto ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.part"
    echo "backup: FALHOU" >&2
  fi
  if [ -d /uploads ]; then
    media="/backups/camps-uploads-$(date +%Y%m%d-%H%M%S).tar.gz"
    if tar -czf "$media.part" -C /uploads .; then
      mv "$media.part" "$media"
      echo "backup: imagens prontas ($(du -h "$media" | cut -f1))"
    else
      rm -f "$media.part"
      echo "backup: imagens FALHARAM" >&2
    fi
  fi
  find /backups \( -name 'camps-*.dump' -o -name 'camps-uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
}

# Uma cópia logo ao arrancar, depois uma por dia.
backup
while true; do
  now=$(date +%s)
  next=$(date -d "today ${HOUR}:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow ${HOUR}:00" +%s)
  sleep $((next - now))
  backup
done
