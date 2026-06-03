interface Props {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean | null;
  loading?: boolean;
}

export default function StatCard({ label, value, sub, positive, loading }: Props) {
  const subColor =
    positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-28 bg-gray-800 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-white">{value}</p>
      )}
      {sub && <p className={`text-sm mt-1 ${subColor}`}>{sub}</p>}
    </div>
  );
}
