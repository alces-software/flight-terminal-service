# Flight Terminal Service

Flight Terminal Service is a service provided by Alces Flight to support
embedding a terminal in a browser session.


## Quick start

To start the terminal server:

```
cp .env.example .env
yarn
yarn run start
```

To see an example of a terminal embedded in a browser using this, see [Flight
Tutorials Client](https://github.com/alces-software/flight-tutorials-client).

To change the configuration either edit `.env`, or pass the new value on the
command line, e.g.,

```
INTERFACE=0.0.0.0 yarn run start
```
