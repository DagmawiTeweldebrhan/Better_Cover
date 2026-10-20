import { loadConfig } from './config';
import { createApp } from './app';
import { createServices } from './services/supabase';

const config = loadConfig();
const app = createApp(config, createServices(config));
const server = app.listen(config.PORT, () => console.log(`Better Cover API listening on ${config.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(() => process.exit(0)); });
