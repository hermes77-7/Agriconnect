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
