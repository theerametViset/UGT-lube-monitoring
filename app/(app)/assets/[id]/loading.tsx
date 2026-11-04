export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-cyan/20 border-t-cyan" />
        <span className="text-[13px] text-t3">กำลังโหลดข้อมูลเครื่องจักร...</span>
      </div>
    </div>
  );
}
