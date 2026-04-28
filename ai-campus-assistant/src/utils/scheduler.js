/**
 * 提取空闲时间池 (修复版：支持循环课表冲突检测)
 */
export const findFreeSlots = (existingEvents, searchStartDate, searchEndDate, minDurationHours = 1) => {
  const freeSlots = [];
  const minDurationMs = minDurationHours * 60 * 60 * 1000;
  
  const WORK_START_HOUR = 8;
  const WORK_END_HOUR = 22; // 晚上10点以后不排长任务

  for (let d = new Date(searchStartDate); d <= searchEndDate; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d);
    dayStart.setHours(WORK_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    const effectiveStart = (d.toDateString() === searchStartDate.toDateString() && new Date() > dayStart) 
                            ? new Date() : dayStart;

    // 【核心修复】：把当天的所有日程（包含单次和循环课表）提取并标准化为时间戳段
    const blockedPeriods = [];

    existingEvents.forEach(event => {
      // 1. 处理普通单次事件 (比如 DDL、开会)
      if (event.start && (!event.daysOfWeek)) {
        const eStart = new Date(event.start);
        const eEnd = new Date(event.end || event.start);
        if (eStart < dayEnd && eEnd > dayStart) {
          blockedPeriods.push({ start: eStart.getTime(), end: eEnd.getTime() });
        }
      }
      // 2. 处理循环课表事件 (比如每周二的系统安全课)
      else if (event.daysOfWeek && event.startTime) {
        const currentDayOfWeek = d.getDay(); // 获取今天是星期几 (0-6)
        
        // 检查今天是不是这门课的上课日，且在不在学期循环周期内
        const startRecurDate = event.startRecur ? new Date(event.startRecur) : new Date(0);
        const endRecurDate = event.endRecur ? new Date(event.endRecur) : new Date(8640000000000000);
        endRecurDate.setHours(23, 59, 59);

        if (
          event.daysOfWeek.includes(currentDayOfWeek) && 
          d >= startRecurDate && 
          d <= endRecurDate
        ) {
          // 拼装出这门课在当天的具体绝对时间
          const [sHour, sMin] = event.startTime.split(':');
          const [eHour, eMin] = event.endTime.split(':');

          const classStart = new Date(d);
          classStart.setHours(parseInt(sHour), parseInt(sMin), 0, 0);

          const classEnd = new Date(d);
          classEnd.setHours(parseInt(eHour), parseInt(eMin), 0, 0);

          blockedPeriods.push({ start: classStart.getTime(), end: classEnd.getTime() });
        }
      }
    });

    // 按照被占用的开始时间排序
    blockedPeriods.sort((a, b) => a.start - b.start);

    // 扫描当天的空隙
    let currentPointer = effectiveStart.getTime();

    for (const period of blockedPeriods) {
      if (period.start > currentPointer) {
        const gap = period.start - currentPointer;
        if (gap >= minDurationMs) {
          freeSlots.push({
            start: new Date(currentPointer).toISOString(),
            end: new Date(period.start).toISOString(),
            durationHours: (gap / (1000 * 60 * 60)).toFixed(1)
          });
        }
      }
      // 更新指针，防止事件重叠导致回退
      if (period.end > currentPointer) {
        currentPointer = period.end;
      }
    }

    // 检查当天最后一节课到晚上 22:00 之间是否有空隙
    if (dayEnd.getTime() > currentPointer) {
      const gap = dayEnd.getTime() - currentPointer;
      if (gap >= minDurationMs) {
        freeSlots.push({
          start: new Date(currentPointer).toISOString(),
          end: new Date(dayEnd).toISOString(),
          durationHours: (gap / (1000 * 60 * 60)).toFixed(1)
        });
      }
    }
  }

  return freeSlots;
};