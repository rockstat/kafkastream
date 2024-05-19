
bump-patch:
	bumpversion patch

bump-minor:
	bumpversion minor


build:
	docker build -t kafkastream .

build_amd64:
	docker buildx build --platform linux/amd64 -t kafkastream .	

tag-ng:
	docker tag kafkastream rockstat/kafkastream:ng

tag-latest:
	docker tag kafkastream rockstat/kafkastream:latest

push-latest:
	docker push rockstat/kafkastream:latest

push-ng:
	docker push rockstat/kafkastream:ng

all-ng: build_amd64 tag-ng push-ng

push-dev:
	docker tag kafkastream rockstat/kafkastream:dev
	docker push rockstat/kafkastream:dev

to_master:
	@echo $(BR)
	git checkout master && git merge $(BR) && git checkout $(BR)
