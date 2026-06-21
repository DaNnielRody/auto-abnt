#!/usr/bin/env node
/**
 * Production server entry (VPS container CMD).
 * -----------------------------------------------------------------------------
 * Boots buildApp(process.env) behind the HTTP boundary and listens on PORT
 * (default 3000). Vendor selection (LLM/COMPILER/PAYMENT) is env-driven at the
 * composition root — this file knows nothing about adapters. Secrets come from
 * the host env at runtime; NONE are baked into the image.
 *
 * Run: `node bin/server.mjs` (or `npm start`). Inside the prod Docker image this
 * is the CMD; on the VPS it's the same, with real keys passed via env.
 */
import { start } from '../src/infrastructure/http/server.js';

start();
