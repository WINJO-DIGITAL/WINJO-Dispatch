'use strict';

// The platform's own addresses, in one place. The website, the Operator app and (through its
// /driver forward) the Driver App all answer on the platform address; each can be overridden
// with an environment variable for another environment (a preview, a dedicated deployment).

const clean = (v) => String(v || '').trim().replace(/\/$/, '');

const PLATFORM_URL = () => clean(process.env.PLATFORM_URL) || 'https://winjo-dispatch.vercel.app';
// The Operator app lives on the same address as the website (pages under /operator, API at the root).
const OPERATOR_APP_URL = () => clean(process.env.OPERATOR_APP_URL) || PLATFORM_URL();
// The Driver App is served under /driver, so its address includes it.
const DRIVER_APP_URL = () => clean(process.env.DRIVER_APP_URL) || `${PLATFORM_URL()}/driver`;

module.exports = { PLATFORM_URL, OPERATOR_APP_URL, DRIVER_APP_URL };
