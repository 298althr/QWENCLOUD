const { deployStack } = require('../src/deploy/deployEngine');

const compose = `services:
  test-nginx:
    image: nginx:alpine
    ports:
      - "9090:80"`;

deployStack({ compose_content: compose, name: 'test-stack' })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => console.error('ERROR:', e.message, e.stack));
