import app from '../../src/worker.js';

export const onRequest = ({ request, env }) => app.fetch(request, env);
