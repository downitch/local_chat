# Local Chat

This is a simple web-based application to communicate with your favorite ollama model.
It is capable to load AGENTS.md file to augment the model with information and config.

## How to setup?

Before proceeding with setup, make sure you have your ollama (e.g. `ollama serve`) and your redis server (e.g. `redis-server`) up and running.

```javascript
git clone https://github.com/downitch/local_client.git
cd local_client
npm install
cp default.env .env
npm start
```

### TODO

This is a fun little project of mine that I often use and update, so be advised to either fork it to have a stable version or be ready for significant changes.
