export type ServiceArea = {
  pincode: string;
  area: string;
  city: string;
  deliveryFee: number;
  sameDayAvailable: boolean;
  morningDeliveryAvailable: boolean;
};

export const serviceAreas: ServiceArea[] = [
  {
    pincode: "500032",
    area: "Gachibowli",
    city: "Hyderabad",
    deliveryFee: 80,
    sameDayAvailable: true,
    morningDeliveryAvailable: true,
  },
  {
    pincode: "500081",
    area: "Madhapur",
    city: "Hyderabad",
    deliveryFee: 80,
    sameDayAvailable: true,
    morningDeliveryAvailable: true,
  },
  {
    pincode: "500084",
    area: "Kondapur",
    city: "Hyderabad",
    deliveryFee: 90,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500089",
    area: "Kokapet",
    city: "Hyderabad",
    deliveryFee: 100,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500090",
    area: "Nizampet / Pragathi Nagar",
    city: "Hyderabad",
    deliveryFee: 100,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500072",
    area: "Kukatpally",
    city: "Hyderabad",
    deliveryFee: 90,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500003",
    area: "Secunderabad",
    city: "Hyderabad",
    deliveryFee: 120,
    sameDayAvailable: false,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500034",
    area: "Banjara Hills",
    city: "Hyderabad",
    deliveryFee: 100,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500033",
    area: "Jubilee Hills",
    city: "Hyderabad",
    deliveryFee: 100,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
  {
    pincode: "500008",
    area: "Mehdipatnam / Tolichowki",
    city: "Hyderabad",
    deliveryFee: 100,
    sameDayAvailable: true,
    morningDeliveryAvailable: false,
  },
];