PORT ?= 80
SERVER ?= swa.sh
BAG ?= /usr/local/bag
build:; docker build -t bag .
run:; docker rm -f bag && docker run -d --name bag -p $(PORT):80 bag
push:; git push
deploy: build push; ssh -A swa.sh "cd $(BAG) && git pull && make build run"
