export class ArtworkImporter {
  private api: any;
  private logger: any;

  constructor(api: any, logger: any) {
    this.api = api;
    this.logger = logger;
  }

  async importArtworks(data: any[]): Promise<any[]> {
    try {
      const artworks = data.map(item => this.mapDataToArtwork(item));
      this.logger.info(`Found ${artworks.length} artworks to import.`);
      return artworks;
    } catch (error) {
      this.logger.error(
        `Error importing artworks: ${error instanceof Error ? error.message : error}`
      );
      throw error;
    }
  }

  async importArtwork(artworkData: any): Promise<any> {
    try {
      const createdArtwork = await this.api.createArtwork(artworkData);
      this.logger.info(`Successfully imported artwork ${artworkData.title}`);
      return createdArtwork;
    } catch (error) {
      this.logger.error(
        `Error importing artwork ${artworkData.title}: ${error instanceof Error ? error.message : error}`
      );
      throw error;
    }
  }

  private mapDataToArtwork(data: any): any {
    return {
      title: data.title || 'Untitled',
      lat: data.lat,
      lon: data.lon,
      tags: data.tags || {},
    };
  }
}
