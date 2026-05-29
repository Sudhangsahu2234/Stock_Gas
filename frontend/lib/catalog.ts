export type CatalogProduct = {
  id: string;
  name: string;
  sizeKg: number;
  priceInr: number;
  badge: string;
  image: string;
  description: string;
  availability: string;
  specs: string[];
};

export const productCatalog: CatalogProduct[] = [
  {
    id: "cyl-3kg",
    name: "StockGas 3 kg Cylinder",
    sizeKg: 3,
    priceInr: 1250,
    badge: "Starter",
    image: "/stockgas-plant-line.jpeg",
    description: "Compact LPG cylinder for students, small apartments, and backup cooking needs.",
    availability: "Available for household delivery",
    specs: ["3 kg LPG", "Portable", "RFID ready"]
  },
  {
    id: "cyl-5kg",
    name: "StockGas 5 kg Cylinder",
    sizeKg: 5,
    priceInr: 1900,
    badge: "Domestic",
    image: "/stockgas-plant-carousel.jpeg",
    description: "A practical refillable size for small households and urban kitchens.",
    availability: "Available for domestic orders",
    specs: ["5 kg LPG", "Refillable", "Safety checked"]
  },
  {
    id: "cyl-6kg",
    name: "StockGas 6 kg Cylinder",
    sizeKg: 6,
    priceInr: 2200,
    badge: "Family",
    image: "/stockgas-plant-line.jpeg",
    description: "Balanced capacity for families that need a little more cooking time between refills.",
    availability: "Available for home delivery",
    specs: ["6 kg LPG", "Tamper seal", "Tracked batch"]
  },
  {
    id: "cyl-12-5kg",
    name: "StockGas 12.5 kg Cylinder",
    sizeKg: 12.5,
    priceInr: 4300,
    badge: "Popular",
    image: "/stockgas-plant-carousel.jpeg",
    description: "The core household cylinder size for regular family cooking and dependable supply.",
    availability: "Priority stock item",
    specs: ["12.5 kg LPG", "Safety valve", "RFID tagged"]
  },
  {
    id: "cyl-25kg",
    name: "StockGas 25 kg Cylinder",
    sizeKg: 25,
    priceInr: 8300,
    badge: "Commercial",
    image: "/stockgas-plant-line.jpeg",
    description: "Commercial capacity for restaurants, caterers, hospitality, and food service teams.",
    availability: "Commercial dispatch available",
    specs: ["25 kg LPG", "Commercial grade", "Bulk friendly"]
  },
  {
    id: "cyl-50kg",
    name: "StockGas 50 kg Cylinder",
    sizeKg: 50,
    priceInr: 15800,
    badge: "Industrial",
    image: "/stockgas-plant-carousel.jpeg",
    description: "Heavy-duty supply for hotels, factories, hospitals, and large industrial kitchens.",
    availability: "Bulk and corporate ordering",
    specs: ["50 kg LPG", "Industrial use", "Contract ready"]
  }
];

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function getProduct(productId: string): CatalogProduct | undefined {
  return productCatalog.find((product) => product.id === productId);
}
