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

export interface Order {
  id: number;
  listingId: number;
  quantityOrdered: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

export interface FilterParams {
  crop?: string;
  category?: Category | "";
  region?: string;
  minPrice?: string;
  maxPrice?: string;
  minQty?: string;
}
