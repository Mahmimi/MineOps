export class AlertProvider {
  async publish() {
    throw new Error('AlertProvider.publish must be implemented');
  }
}

export class DiscordAlertProvider extends AlertProvider {
  constructor({ client, channelId }) {
    super();
    this.client = client;
    this.channelId = channelId;
  }

  async publish(content) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) {
      throw new Error('configured Discord alert channel is not text-based');
    }
    await channel.send({ content });
  }
}
