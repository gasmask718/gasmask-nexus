// US States with major cities for territory automation
export interface StateConfig {
  name: string;
  abbr: string;
  cities: string[];
}

export const US_STATES: StateConfig[] = [
  { name: "Alabama", abbr: "AL", cities: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa"] },
  { name: "Alaska", abbr: "AK", cities: ["Anchorage", "Fairbanks", "Juneau"] },
  { name: "Arizona", abbr: "AZ", cities: ["Phoenix", "Tucson", "Mesa", "Scottsdale", "Chandler", "Tempe"] },
  { name: "Arkansas", abbr: "AR", cities: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale"] },
  { name: "California", abbr: "CA", cities: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland", "Fresno", "Long Beach", "Anaheim", "Irvine"] },
  { name: "Colorado", abbr: "CO", cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Boulder"] },
  { name: "Connecticut", abbr: "CT", cities: ["Hartford", "New Haven", "Stamford", "Bridgeport", "Waterbury"] },
  { name: "Delaware", abbr: "DE", cities: ["Wilmington", "Dover", "Newark"] },
  { name: "Florida", abbr: "FL", cities: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "St. Petersburg", "Hialeah", "West Palm Beach"] },
  { name: "Georgia", abbr: "GA", cities: ["Atlanta", "Savannah", "Augusta", "Columbus", "Macon", "Athens"] },
  { name: "Hawaii", abbr: "HI", cities: ["Honolulu", "Hilo", "Kailua"] },
  { name: "Idaho", abbr: "ID", cities: ["Boise", "Meridian", "Nampa", "Idaho Falls"] },
  { name: "Illinois", abbr: "IL", cities: ["Chicago", "Aurora", "Naperville", "Rockford", "Springfield", "Joliet"] },
  { name: "Indiana", abbr: "IN", cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"] },
  { name: "Iowa", abbr: "IA", cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City"] },
  { name: "Kansas", abbr: "KS", cities: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"] },
  { name: "Kentucky", abbr: "KY", cities: ["Louisville", "Lexington", "Bowling Green", "Covington"] },
  { name: "Louisiana", abbr: "LA", cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"] },
  { name: "Maine", abbr: "ME", cities: ["Portland", "Bangor", "Lewiston"] },
  { name: "Maryland", abbr: "MD", cities: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Annapolis"] },
  { name: "Massachusetts", abbr: "MA", cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"] },
  { name: "Michigan", abbr: "MI", cities: ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing", "Flint"] },
  { name: "Minnesota", abbr: "MN", cities: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington"] },
  { name: "Mississippi", abbr: "MS", cities: ["Jackson", "Gulfport", "Biloxi", "Hattiesburg"] },
  { name: "Missouri", abbr: "MO", cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"] },
  { name: "Montana", abbr: "MT", cities: ["Billings", "Missoula", "Great Falls", "Bozeman"] },
  { name: "Nebraska", abbr: "NE", cities: ["Omaha", "Lincoln", "Bellevue"] },
  { name: "Nevada", abbr: "NV", cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"] },
  { name: "New Hampshire", abbr: "NH", cities: ["Manchester", "Nashua", "Concord"] },
  { name: "New Jersey", abbr: "NJ", cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Trenton"] },
  { name: "New Mexico", abbr: "NM", cities: ["Albuquerque", "Las Cruces", "Santa Fe", "Rio Rancho"] },
  { name: "New York", abbr: "NY", cities: ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse", "Yonkers"] },
  { name: "North Carolina", abbr: "NC", cities: ["Charlotte", "Raleigh", "Durham", "Greensboro", "Winston-Salem", "Fayetteville"] },
  { name: "North Dakota", abbr: "ND", cities: ["Fargo", "Bismarck", "Grand Forks", "Minot"] },
  { name: "Ohio", abbr: "OH", cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"] },
  { name: "Oklahoma", abbr: "OK", cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow"] },
  { name: "Oregon", abbr: "OR", cities: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro"] },
  { name: "Pennsylvania", abbr: "PA", cities: ["Philadelphia", "Pittsburgh", "Allentown", "Reading", "Erie", "Harrisburg"] },
  { name: "Rhode Island", abbr: "RI", cities: ["Providence", "Warwick", "Cranston", "Pawtucket"] },
  { name: "South Carolina", abbr: "SC", cities: ["Charleston", "Columbia", "Greenville", "Myrtle Beach", "Rock Hill"] },
  { name: "South Dakota", abbr: "SD", cities: ["Sioux Falls", "Rapid City", "Aberdeen"] },
  { name: "Tennessee", abbr: "TN", cities: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"] },
  { name: "Texas", abbr: "TX", cities: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso", "Arlington", "Plano", "Frisco"] },
  { name: "Utah", abbr: "UT", cities: ["Salt Lake City", "Provo", "West Jordan", "Orem", "Sandy"] },
  { name: "Vermont", abbr: "VT", cities: ["Burlington", "Rutland", "South Burlington"] },
  { name: "Virginia", abbr: "VA", cities: ["Virginia Beach", "Norfolk", "Richmond", "Arlington", "Alexandria", "Newport News"] },
  { name: "Washington", abbr: "WA", cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent"] },
  { name: "West Virginia", abbr: "WV", cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg"] },
  { name: "Wisconsin", abbr: "WI", cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine"] },
  { name: "Wyoming", abbr: "WY", cities: ["Cheyenne", "Casper", "Laramie", "Gillette"] },
];

export const UT_CATEGORIES = [
  "event_halls",
  "party_rentals",
  "caterers",
  "decorators",
  "djs",
  "photographers",
  "videographers",
  "florists",
  "photo_booths",
  "bartending",
  "event_planners",
  "lighting",
  "staffing",
  "transportation",
  "entertainment",
];

export function getStateByName(name: string) {
  return US_STATES.find(s => s.name === name);
}

export function getStateByAbbr(abbr: string) {
  return US_STATES.find(s => s.abbr === abbr);
}
