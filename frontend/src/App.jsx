import TopBar from "./components/header/TopBar";
import IngestionPanel from "./components/IngestSide/IngestionPanel";
import QueryPanel from "./components/chat/QueryPanel";

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-black text-white overflow-auto">
      <TopBar />
      <div className="grid grid-cols-12 overflow-auto md:overflow-hidden lg:flex-row">
        <IngestionPanel />
        <QueryPanel />
      </div>
    </div>
  );
}