interface GeocodeResult {
  lat: number;
  lng: number;
  full_address?: string;
}

interface GeocodeError {
  error: string;
}

export class GeocodingService {
  private static readonly MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
  private static readonly BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

  /**
   * Geocode a full address string to lat/lng coordinates
   */
  static async geocodeAddress(
    street?: string | null,
    city?: string | null,
    state?: string | null,
    zip?: string | null,
    country: string = 'USA'
  ): Promise<GeocodeResult | GeocodeError> {
    if (!this.MAPBOX_TOKEN) {
      return { error: 'Mapbox token not configured' };
    }

    // Build address string
    const addressParts = [street, city, state, zip, country].filter(Boolean);
    if (addressParts.length === 0) {
      return { error: 'No address provided' };
    }

    const addressString = addressParts.join(', ');
    const encodedAddress = encodeURIComponent(addressString);

    try {
      const url = `${this.BASE_URL}/${encodedAddress}.json?access_token=${this.MAPBOX_TOKEN}&limit=1`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { error: 'Address not found' };
      }

      const [lng, lat] = data.features[0].center;
      const full_address = data.features[0].place_name;

      return {
        lat,
        lng,
        full_address,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return { error: error instanceof Error ? error.message : 'Geocoding failed' };
    }
  }

  /**
   * Batch geocode multiple addresses
   */
  static async batchGeocode(
    addresses: Array<{
      street?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
      country?: string;
    }>
  ): Promise<Array<GeocodeResult | GeocodeError>> {
    const results = await Promise.all(
      addresses.map((addr) =>
        this.geocodeAddress(addr.street, addr.city, addr.state, addr.zip, addr.country || 'USA')
      )
    );
    return results;
  }

  /**
   * Reverse geocode coordinates to an address
   */
  static async reverseGeocode(
    lat: number,
    lng: number
  ): Promise<{ address: string } | GeocodeError> {
    if (!this.MAPBOX_TOKEN) {
      return { error: 'Mapbox token not configured' };
    }

    try {
      const url = `${this.BASE_URL}/${lng},${lat}.json?access_token=${this.MAPBOX_TOKEN}&limit=1`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { error: 'Location not found' };
      }

      return {
        address: data.features[0].place_name,
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return { error: error instanceof Error ? error.message : 'Reverse geocoding failed' };
    }
  }
}
