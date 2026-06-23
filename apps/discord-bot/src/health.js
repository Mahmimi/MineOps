import http from 'node:http';

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export function startHealthServer({ config, logger, runtimeState, platformService }) {
  const server = http.createServer(async (request, response) => {
    if (request.url === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: config.serviceName,
        uptimeSeconds: Math.floor(process.uptime()),
      });
      return;
    }

    if (request.url === '/ready') {
      try {
        await platformService.checkReadiness();
        const discordReady = !config.discord.required || runtimeState.discordConnected;
        sendJson(response, discordReady ? 200 : 503, {
          status: discordReady ? 'ready' : 'not_ready',
          kubernetesReadable: true,
          discordConnected: runtimeState.discordConnected,
          discordRequired: config.discord.required,
        });
      } catch (error) {
        sendJson(response, 503, {
          status: 'not_ready',
          kubernetesReadable: false,
          discordConnected: runtimeState.discordConnected,
          error: error.message,
        });
      }
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });

  server.listen(config.httpPort, () => {
    logger.info('health server started', { port: config.httpPort });
  });

  return server;
}
