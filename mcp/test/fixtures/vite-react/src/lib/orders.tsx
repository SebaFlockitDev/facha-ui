import { createContext, useContext } from "react";

const ORDERS = [
  { id: 1048, customer: "Martina López", total: 48250, status: "review" },
  { id: 1052, customer: "Diego Fernández", total: 12900, status: "sent" },
  { id: 1055, customer: "Ana Gómez", total: 86400, status: "review" },
  { id: 1057, customer: "Lucas Pérez", total: 23150, status: "delivered" },
];

const OrdersContext = createContext(null);

export function OrdersProvider({ children }) {
  return <OrdersContext.Provider value={{ orders: ORDERS }}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
