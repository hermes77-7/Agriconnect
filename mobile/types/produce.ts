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
