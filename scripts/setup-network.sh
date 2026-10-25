#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
network_address="${1:-$(ip -4 route get 1.1.1.1 | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')}"
# Validate before including the address in certificate arguments or configuration.
gjs -m "$project_dir/scripts/lib/check-address.js" "$network_address"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/smartphone-rc"
mkdir -p "$config_dir"
chmod 700 "$config_dir"
if [[ ! -f "$config_dir/private-key.pem" ]]; then
    openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$config_dir/private-key.pem"
fi
openssl req -new -x509 -sha256 -days 90 \
    -key "$config_dir/private-key.pem" -out "$config_dir/certificate.pem.tmp" \
    -subj '/CN=Smartphone Remote Control' \
    -addext "subjectAltName=IP:$network_address" \
    -addext 'basicConstraints=critical,CA:FALSE' \
    -addext 'keyUsage=critical,digitalSignature' \
    -addext 'extendedKeyUsage=serverAuth'
mv "$config_dir/certificate.pem.tmp" "$config_dir/certificate.pem"
printf '{"address":"%s"}\n' "$network_address" > "$config_dir/network.json"
echo "Local network address: https://$network_address:8844"
echo 'Local certificate fingerprint (compare with the certificate shown by the phone browser):'
openssl x509 -in "$config_dir/certificate.pem" -noout -fingerprint -sha256
echo 'Choose "Start remote control" in the extension menu, then copy the pairing link.'
