default:
	@just --list

setup:
	npm install

build:
	npm run typecheck

test:
	npm test

lint:
	npm run lint

format:
	npm run format

typecheck:
	npm run typecheck

run:
	npm start -- --help

clean:
	rm -rf node_modules

ci: lint typecheck test
