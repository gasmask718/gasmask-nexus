// NYC Borough Territory GeoJSON Data
export interface Territory {
  id: string;
  name: string;
  color: string;
  coordinates: [number, number][][];
}

export const territories: Territory[] = [
  {
    id: 'bronx',
    name: 'Bronx',
    color: '#ef4444',
    coordinates: [[
      [-73.933, 40.915],
      [-73.765, 40.915],
      [-73.765, 40.785],
      [-73.810, 40.785],
      [-73.933, 40.815],
      [-73.933, 40.915]
    ]]
  },
  {
    id: 'brooklyn',
    name: 'Brooklyn',
    color: '#f97316',
    coordinates: [[
      [-74.042, 40.739],
      [-73.833, 40.739],
      [-73.833, 40.551],
      [-74.042, 40.551],
      [-74.042, 40.739]
    ]]
  },
  {
    id: 'queens',
    name: 'Queens',
    color: '#eab308',
    coordinates: [[
      [-73.962, 40.800],
      [-73.700, 40.800],
      [-73.700, 40.542],
      [-73.962, 40.542],
      [-73.962, 40.800]
    ]]
  },
  {
    id: 'manhattan',
    name: 'Manhattan',
    color: '#22c55e',
    coordinates: [[
      [-74.019, 40.882],
      [-73.907, 40.882],
      [-73.907, 40.700],
      [-74.019, 40.700],
      [-74.019, 40.882]
    ]]
  },
  {
    id: 'staten_island',
    name: 'Staten Island',
    color: '#6366f1',
    coordinates: [[
      [-74.255, 40.651],
      [-74.050, 40.651],
      [-74.050, 40.477],
      [-74.255, 40.477],
      [-74.255, 40.651]
    ]]
  }
];
