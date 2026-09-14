export default function SourceTypeTabs({ active, onChange }) {
  const tabs = [
    { id: "note", label: "Text Note" },
    { id: "url", label: "URL Source" },
  ];

  return (
    <div className="flex overflow-hidden rounded-md border border-neutral-700 m-auto sm:m-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            active === tab.id
              ? "bg-white text-black"
              : "bg-transparent text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
