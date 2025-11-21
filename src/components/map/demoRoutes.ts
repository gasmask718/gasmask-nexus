export interface RouteStop {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  order: number;
  estimatedTime: string;
}

export interface DemoRoute {
  id: string;
  driverId: string;
  driverName: string;
  territory: string;
  type: 'driver' | 'biker';
  status: 'planned' | 'in-progress' | 'completed';
  stops: RouteStop[];
  polyline: [number, number][];
}

export const demoRoutes: DemoRoute[] = [
  {
    id: 'route-1',
    driverId: '1',
    driverName: 'Malik Driver',
    territory: 'Bronx',
    type: 'driver',
    status: 'in-progress',
    stops: [
      { storeId: 's1', storeName: 'Store A', lat: 40.8176, lng: -73.9182, order: 1, estimatedTime: '9:00 AM' },
      { storeId: 's2', storeName: 'Store B', lat: 40.8250, lng: -73.9100, order: 2, estimatedTime: '9:30 AM' },
      { storeId: 's3', storeName: 'Store C', lat: 40.8350, lng: -73.9050, order: 3, estimatedTime: '10:00 AM' },
      { storeId: 's4', storeName: 'Store D', lat: 40.8400, lng: -73.9150, order: 4, estimatedTime: '10:30 AM' }
    ],
    polyline: [
      [-73.9182, 40.8176],
      [-73.9100, 40.8250],
      [-73.9050, 40.8350],
      [-73.9150, 40.8400]
    ]
  },
  {
    id: 'route-2',
    driverId: '2',
    driverName: 'Jayden Driver',
    territory: 'Brooklyn',
    type: 'driver',
    status: 'in-progress',
    stops: [
      { storeId: 's5', storeName: 'Store E', lat: 40.7145, lng: -73.9565, order: 1, estimatedTime: '9:00 AM' },
      { storeId: 's6', storeName: 'Store F', lat: 40.7050, lng: -73.9500, order: 2, estimatedTime: '9:45 AM' },
      { storeId: 's7', storeName: 'Store G', lat: 40.6950, lng: -73.9400, order: 3, estimatedTime: '10:30 AM' }
    ],
    polyline: [
      [-73.9565, 40.7145],
      [-73.9500, 40.7050],
      [-73.9400, 40.6950]
    ]
  },
  {
    id: 'route-3',
    driverId: '3',
    driverName: 'Carlos Driver',
    territory: 'Queens',
    type: 'driver',
    status: 'planned',
    stops: [
      { storeId: 's8', storeName: 'Store H', lat: 40.7632, lng: -73.9202, order: 1, estimatedTime: '11:00 AM' },
      { storeId: 's9', storeName: 'Store I', lat: 40.7550, lng: -73.9100, order: 2, estimatedTime: '11:30 AM' },
      { storeId: 's10', storeName: 'Store J', lat: 40.7450, lng: -73.9000, order: 3, estimatedTime: '12:00 PM' },
      { storeId: 's11', storeName: 'Store K', lat: 40.7350, lng: -73.8900, order: 4, estimatedTime: '12:30 PM' }
    ],
    polyline: [
      [-73.9202, 40.7632],
      [-73.9100, 40.7550],
      [-73.9000, 40.7450],
      [-73.8900, 40.7350]
    ]
  },
  {
    id: 'route-4',
    driverId: '4',
    driverName: 'Marcus Driver',
    territory: 'Manhattan',
    type: 'driver',
    status: 'in-progress',
    stops: [
      { storeId: 's12', storeName: 'Store L', lat: 40.7265, lng: -73.9815, order: 1, estimatedTime: '8:30 AM' },
      { storeId: 's13', storeName: 'Store M', lat: 40.7400, lng: -73.9900, order: 2, estimatedTime: '9:15 AM' },
      { storeId: 's14', storeName: 'Store N', lat: 40.7500, lng: -73.9950, order: 3, estimatedTime: '10:00 AM' }
    ],
    polyline: [
      [-73.9815, 40.7265],
      [-73.9900, 40.7400],
      [-73.9950, 40.7500]
    ]
  },
  {
    id: 'route-5',
    driverId: '5',
    driverName: 'Luis Biker',
    territory: 'Bronx',
    type: 'biker',
    status: 'in-progress',
    stops: [
      { storeId: 's15', storeName: 'Store O', lat: 40.8405, lng: -73.9157, order: 1, estimatedTime: '10:00 AM' },
      { storeId: 's16', storeName: 'Store P', lat: 40.8450, lng: -73.9100, order: 2, estimatedTime: '10:20 AM' },
      { storeId: 's17', storeName: 'Store Q', lat: 40.8500, lng: -73.9050, order: 3, estimatedTime: '10:40 AM' }
    ],
    polyline: [
      [-73.9157, 40.8405],
      [-73.9100, 40.8450],
      [-73.9050, 40.8500]
    ]
  },
  {
    id: 'route-6',
    driverId: '6',
    driverName: 'Andre Biker',
    territory: 'Brooklyn',
    type: 'biker',
    status: 'completed',
    stops: [
      { storeId: 's18', storeName: 'Store R', lat: 40.6973, lng: -73.9197, order: 1, estimatedTime: '8:00 AM' },
      { storeId: 's19', storeName: 'Store S', lat: 40.6900, lng: -73.9150, order: 2, estimatedTime: '8:30 AM' }
    ],
    polyline: [
      [-73.9197, 40.6973],
      [-73.9150, 40.6900]
    ]
  }
];
