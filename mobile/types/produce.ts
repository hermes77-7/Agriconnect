export type ListingStatus = "Available" | "Reserved" | "Sold";
export type Category =
  | "Fruits"
  | "Vegetables"
  | "Grains"
  | "Legumes"
  | "Tubers"
  | "Spices"
  | "Dairy"
  | "Other";

export interface Farmer {
  id: number;
  name: string;
  phone: string;
}

export interface Listing {
  id: number;
  cropName: string;
  category: Category;
  totalQuantity: number;
  availableQty: number;
  minOrderQty: number;
  price: number;
  pickupLocation: string;
  region: string;
  description: string;
  imageUrl: string;
  status: ListingStatus;
  createdAt: string;
  farmer: Farmer;
}

export interface FilterParams {
  crop?: string;
  category?: Category | "";
  region?: string;
  minPrice?: string;
  maxPrice?: string;
  minQty?: string;
}

export interface Order {
  id: number;
  listingId: number;
  quantityOrdered: number;
  totalPrice: number;
  status: "Pending" | "Accepted" | "Cancelled" | "Rejected" | "Completed";
  createdAt: string;
  listing: {
    cropName: string;
    category: string;
    pricePerKg: number;
    pickupLocation: string;
    region: string;
    imageUrl: string;
  };
  farmer?: {
    id: number;
    name: string;
    phone: string;
  };
  buyer?: {
    id: number;
    name: string;
    phone: string;
    type: string;
  };
}

export type TransportStatus =
  | "Pending"
  | "In_Transit"
  | "Delivered"
  | "Cancelled";

export interface TransportJob {
  id: number;
  pickupLocation: string;
  destination: string;
  cargoDesc: string;
  transportDate: string;
  estimatedWeight: number;
  price: number;
  specialInstructions: string;
  status: TransportStatus;
  createdAt: string;
  cropName: string;
  requestedBy: {
    id: number;
    name: string;
    phone: string;
  };
}

export interface TransportCheck {
  exists: boolean;
  id?: number;
  status?: TransportStatus;
  isAssigned?: boolean;
  pickupLocation?: string;
  destination?: string;
  cargoDesc?: string;
  transportDate?: string;
  estimatedWeight?: number;
  price?: number;
}

export interface CropAnalysis {
  id: number;
  cropName: string;
  result: "Healthy" | "Diseased" | "Nutrient Deficiency";
  confidence: number;
  recommendations: string[];
  imagePath: string;
  analyzedAt: string;
}