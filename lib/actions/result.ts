export interface ActionResult {
  ok: boolean;
  demo?: boolean;
  message: string;
  id?: string;
}

export function demoBlocked(): ActionResult {
  return {
    ok: false,
    demo: true,
    message: "ยังไม่บันทึกจริง — เชื่อม Supabase เพื่อบันทึก",
  };
}

// Wrap a Server Action body so an unexpected throw (network blip, a
// revalidatePath issue, a runtime error) returns the normal ActionResult
// shape instead of crashing the page's error boundary.
export async function runAction<T extends ActionResult>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[action]", e);
    return { ok: false, message: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่" } as T;
  }
}
