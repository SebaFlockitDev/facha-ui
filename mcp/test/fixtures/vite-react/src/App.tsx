import { Route, Routes } from "react-router-dom";
import Orders from "./pages/Orders.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Orders />} />
      <Route path="/orders" element={<Orders />} />
    </Routes>
  );
}
