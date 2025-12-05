PROJECT = swipe
SRC = index.js

all: check compile

compile: build/build.js

build:
	mkdir -p $@

build/build.js: $(SRC) | build
	node_modules/.bin/esbuild \
		--bundle \
		--sourcemap \
		--define:DEBUG="true" \
		--global-name=$(PROJECT) \
		--outfile=$@ \
		index.js

clean:
	rm -fr build

distclean: clean
	rm -rf node_modules

check: lint

lint:
	./node_modules/.bin/biome ci

format:
	./node_modules/.bin/biome check --fix

.PHONY: check lint test check compile
