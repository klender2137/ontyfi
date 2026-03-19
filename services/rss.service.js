// RSS Service Stub
// Placeholder implementation to prevent startup errors

class RSSService {
  constructor() {
    this.name = 'RSS Service';
  }

  async fetchAndSaveAll() {
    console.log('[RSS] Stub service - fetchAndSaveAll called');
    return {
      success: true,
      message: 'RSS service stub - not implemented',
      data: []
    };
  }
}

export default new RSSService();
