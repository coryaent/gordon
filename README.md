# gordon
Automation assistant for [Garage](https://garagehq.deuxfleurs.fr/)

## Initialization
Passing the command line argument `--init` will create a new cluster based on labels from the swarm nodes.

### Envorinment
- `GORDON_EXPECTED_NODE_COUNT` (total number of gateway and storage nodes)
- `GORDON_ADMIN_ENDPOINT`
- `GORDON_ADMIN_TOKEN`
- `GORDON_ADMIN_TOKEN_FILE` (overrides `GORDON_ADMIN_TOKEN`)
- `GORDON_CAPACITY_LABEL` (e.g. `swarm.yachts.garage.capacity`, "null" for gateways)
- `GORDON_ZONE_LABEL` (e.g. `swarm.yachts.garage.zone`)
- `GORDON_TAGS_LABEL` (e.g. `swarm.yachts.garage.tags`, space-seperated array)


## Bucket Creation
By passing the command line argument `--create-bucket`, a new bucket will be created, and its keys will be displayed in the docker service logs. Optionally, one can set a name for the bucket by passing the environmental variable `GORDON_NEW_BUCKET_NAME`, which gives the new bucket a global alias.

## Development
```bash
cat > garage.toml <<EOF
metadata_dir = "/tmp/meta"
data_dir = "/tmp/data"
db_engine = "sqlite"

replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "$(openssl rand -hex 32)"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"

[k2v_api]
api_bind_addr = "[::]:3904"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "$(openssl rand -base64 32)"
metrics_token = "$(openssl rand -base64 32)"
EOF
```

```bash
docker run -it --rm --network host -v ./garage.toml:/etc/garage.toml dxflrs/garage:v1.0.0 /garage server
```
