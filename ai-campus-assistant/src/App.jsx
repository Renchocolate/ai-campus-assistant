import { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { findFreeSlots } from './utils/scheduler';
function App() {
  const [permission, setPermission] = useState(
  'Notification' in window ? Notification.permission : 'unsupported'
);
// 1. 确保这段 Toast 状态和函数在这里！
  const [setToast] = useState({ visible: false, message: '', title: '' });

  const showToast = (title, message) => {
    setToast({ visible: true, title, message });
    // 5秒后自动消失
    setTimeout(() => {
      setToast({ visible: false, title: '', message: '' });
    }, 5000);
  };
  const [isThinking, setIsThinking] = useState(false); // AI 思考状态
  const calendarRef = useRef(null);
  // 新增的高级表单状态
  const [taskName, setTaskName] = useState('');
  const [isLongTerm, setIsLongTerm] = useState(false);
  const [taskDDL, setTaskDDL] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  // 在 App 组件内部添加状态
const [isSleeping, setIsSleeping] = useState(JSON.parse(localStorage.getItem('isSleeping')) || false);
const [sleepStartTime, setSleepStartTime] = useState(localStorage.getItem('sleepStartTime') || null);
// 任务注册表：记录所有通过 AI 调度的原始任务
  const [taskRegistry, setTaskRegistry] = useState(() => {
    const savedTasks = localStorage.getItem('campus_tasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  // 同步任务表到本地存储
  useEffect(() => {
    localStorage.setItem('campus_tasks', JSON.stringify(taskRegistry));
  }, [taskRegistry]);

  // 控制管理面板的开关
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  // 当前正在编辑的任务
// 1. 初始化时从本地存储加载
const [events, setEvents] = useState(() => {
  const savedEvents = localStorage.getItem('campus_events');
  return savedEvents ? JSON.parse(savedEvents) : [];
});

// 2. 当 events 改变时，自动保存到本地存储
useEffect(() => {
  localStorage.setItem('campus_events', JSON.stringify(events));
}, [events]);
// 监听睡眠状态变化，同步到本地存储
useEffect(() => {
  localStorage.setItem('isSleeping', JSON.stringify(isSleeping));
  if (sleepStartTime) localStorage.setItem('sleepStartTime', sleepStartTime);
}, [isSleeping, sleepStartTime]);
// 在你原有的 useState 下方加入：
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
// 核心：睡眠守护进程
useEffect(() => {
  let watcher = null;
  if (isSleeping && sleepStartTime) {
    watcher = setInterval(() => {
      const now = new Date();
      const start = new Date(sleepStartTime);
      const diffHours = (now - start) / (1000 * 60 * 60);

      // 如果超过 7.5 小时且未起床
      if (diffHours >= 7.5) {
        new Notification("作息状态确认", {
          body: "你已经睡了超过 7.5 小时了，是忘记点击‘起床’了吗？",
          requireInteraction: true // 让通知一直停留在屏幕上直到点击
        });
        // 为了防止通知狂轰乱炸，可以触发一次后清除这个特定检查
      }
    }, 60000); // 每分钟检查一次
  }
  return () => clearInterval(watcher);
}, [isSleeping, sleepStartTime]);
useEffect(() => {
  // 每分钟执行一次检查
  const timer = setInterval(() => {
    if (isSleeping) return; // 睡觉时不轰炸通知

    const now = new Date();
    const nowTime = now.getTime();

    events.forEach(event => {
      const startTime = new Date(event.start).getTime();
      const diffMinutes = Math.floor((startTime - nowTime) / (1000 * 60));

      // 检查提醒阈值
      const alertThresholds = [60, 5, 1, 0]; 
      
      if (alertThresholds.includes(diffMinutes)) {
        // 为了防止重复提醒，可以在 event 对象里加一个 lastNotified 标记
        // 这里简化演示直接发出
        new Notification(`任务提醒: ${event.title}`, {
          body: diffMinutes === 0 ? "任务现在开始！" : `任务将在 ${diffMinutes} 分钟后开始`,
          icon: "/logo.png" // 如果你有图标的话
        });
      }
    });
  }, 60000); // 60秒扫描一次

  return () => clearInterval(timer);
}, [events, isSleeping]);
// 动作函数
const handleGoToSleep = () => {
  setIsSleeping(true);
  setSleepStartTime(new Date().toISOString());
  new Notification("晚安", { body: "睡眠模式已开启，期间将暂停所有任务规划。" });
};

const handleWakeUp = () => {
  setIsSleeping(false);
  setSleepStartTime(null);
  localStorage.removeItem('sleepStartTime');
  new Notification("早安", { body: "欢迎回来，AI 助手已准备好为你规划今日任务。" });
};
  // 1. 通知权限申请逻辑
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert("⚠️ 你的当前手机浏览器不支持系统级通知功能，请尝试使用 Chrome 或 Edge 浏览器。");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification("权限开启成功", { body: "AI 助手将在这里提醒你的日程。" });
    }
  };
// 2. 旗舰版：日期解析，提取详细的年月日时分秒和星期几
  const parseDateString = (dateStr) => {
    // 清除特殊字符，提取纯数字
    const cleanStr = dateStr.replace(/[^a-zA-Z0-9]/g, '');
    const match = cleanStr.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2}))?/);
    
    if (match) {
      const year = match[1], month = match[2], day = match[3];
      const hour = match[5] || '00', minute = match[6] || '00', second = match[7] || '00';
      
      // 构造 JS Date 对象以获取这天是星期几 (0是周日，1是周一)
      const dateObj = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      
      return {
        full: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
        dateOnly: `${year}-${month}-${day}`, // 用于循环的开始和结束日期
        timeOnly: `${hour}:${minute}:${second}`, // 用于循环的每日起止时间
        dayOfWeek: dateObj.getDay() 
      };
    }
    return null;
  };

  // 3. 旗舰版：支持 RRULE (每周循环) 的 ICS 解析器
  const parseICS = (icsData) => {
    const parsedEvents = [];
    const lines = icsData.split(/\r\n|\n|\r/);
    let currentEvent = null;

    for (let line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        currentEvent = {}; 
      } else if (line.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.title) {
          
          // 核心逻辑分支：如果识别到这是一个【每周循环】的课
          if (currentEvent._isWeekly && currentEvent._startParsed && currentEvent._endParsed) {
             parsedEvents.push({
               title: currentEvent.title,
               daysOfWeek: [currentEvent._startParsed.dayOfWeek], // 确定是每周几上课
               startTime: currentEvent._startParsed.timeOnly,     // 每日上课时间
               endTime: currentEvent._endParsed.timeOnly,         // 每日下课时间
               startRecur: currentEvent._startParsed.dateOnly,    // 学期开始（循环起始）
               endRecur: currentEvent._until || '2026-12-31'      // 学期结束（循环截止）
             });
          } 
          // 分支二：如果只是【单次】的普通 DDL 或会议
          else if (currentEvent._startParsed) {
             parsedEvents.push({
               title: currentEvent.title,
               start: currentEvent._startParsed.full,
               end: currentEvent._endParsed ? currentEvent._endParsed.full : currentEvent._startParsed.full
             });
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        
        if (line.startsWith('SUMMARY:')) {
          currentEvent.title = line.substring(8).trim();
        } else if (line.startsWith('DTSTART')) {
          const dateVal = line.substring(line.indexOf(':') + 1); 
          currentEvent._startParsed = parseDateString(dateVal); // 暂存解析结果
        } else if (line.startsWith('DTEND')) {
          const dateVal = line.substring(line.indexOf(':') + 1);
          currentEvent._endParsed = parseDateString(dateVal);
        } else if (line.startsWith('RRULE:')) {
          // 【抓取循环规则】比如：RRULE:FREQ=WEEKLY;UNTIL=20260621T160000Z
          if (line.includes('FREQ=WEEKLY')) {
            currentEvent._isWeekly = true;
            const untilMatch = line.match(/UNTIL=([0-9T]+Z?)/);
            if (untilMatch) {
              const parsedUntil = parseDateString(untilMatch[1]);
              if (parsedUntil) currentEvent._until = parsedUntil.dateOnly;
            }
          }
        }
        
      }
    }
    return parsedEvents;
  };

  // 4. 植入探针的文件上传
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const icsText = event.target.result;
      const extractedEvents = parseICS(icsText);
      
      // 【探针】将解析后的真实数据打印在控制台
      console.log("=== 解析出的原始事件数据 ===", extractedEvents);
      
      setEvents(extractedEvents); 
      alert(`成功导入 ${extractedEvents.length} 条日程！请在按 F12 在 Console 查看详细数据。`);
    };
    reader.readAsText(file);
  };
// 终极感知进化版：支持防重叠、作息红线与循环日程
  const handleSmartSchedule = async () => {
    if (isSleeping) {
      alert("当前处于睡眠模式，系统已暂停调度。请先点击‘起床’。");
      return;
    }
    if (!taskName.trim()) {
      alert("信息安全第一法则：不要传入空负载 (Payload)！请填写任务名称。");
      return;
    }

    setIsThinking(true);
    const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY; 
    const API_URL = "https://api.deepseek.com/chat/completions"; 

    try {
      const taskId = `task_${Date.now()}`; 

      // 【雷达开启】：提取日历上已有的所有日程，压缩成文本喂给 AI，用来防撞车
      const existingScheduleStr = events.map(e => {
        if (e.daysOfWeek) return `[循环课表/任务] 每周 ${e.daysOfWeek.join(',')}, 时间: ${e.startTime}-${e.endTime}`;
        return `[单次任务] 开始: ${e.start}, 结束: ${e.end || '未知'}`;
      }).join('\n');

      if (!isLongTerm) {
        // ========== 【分支一：单次 / 循环任务】 ==========
        const todayStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        
        // 【核心进化】：史上最严厉的 System Prompt
        const systemPrompt = `你是一个顶级的私人日程大管家。当前系统时间是：${todayStr}。
        【高压红线规则】
        1. 睡眠禁区：绝对不允许把任何任务安排在 01:00 到 07:30 之间！
        2. 冲突规避：你必须避开用户的已有日程，绝不能时间重叠！用户的已有日程如下：
        ${existingScheduleStr || '当前日历为空'}
        
        【输出格式要求】
        1. 如果用户意图是单次任务，输出格式：[{"title": "名称", "start": "YYYY-MM-DDTHH:mm:00", "end": "YYYY-MM-DDTHH:mm:00"}]
        2. 如果用户意图是“每天、每周、每个工作日”等循环任务，必须输出 FullCalendar 循环语法：
        [{"title": "名称", "daysOfWeek": [1,3,5], "startTime": "08:00:00", "endTime": "09:00:00"}] 
        (注：daysOfWeek数组中，0是周日，1是周一，依次类推到6是周六)
        3. 动态习惯任务：如果用户输入“每天背单词”或“每周三次运动”，请使用单次任务的 JSON 数组格式，自动寻找未来 7 天内每天/每周的空闲缝隙填入，持续时间默认为 30-60 分钟。
        
        仅返回合法的 JSON 数组，不要带任何 markdown (比如 \`\`\`json) 或多余解释！`;
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `请帮我安排这个日程：${taskName}` }
            ],
            temperature: 0.1
          })
        });

        const data = await response.json();
        let aiResultStr = data.choices[0].message.content.trim();
        // 暴力清除模型可能带回来的 markdown 格式
        aiResultStr = aiResultStr.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log("模型原始返回:", aiResultStr);
        const parsedEvents = JSON.parse(aiResultStr);
        
        const parentTask = { id: taskId, name: taskName, isLongTerm: false, ddl: null, estimatedHours: null, status: 'active' };
        setTaskRegistry(prev => [...prev, parentTask]);

        const formattedEvents = parsedEvents.map(e => ({
          ...e,
          groupId: taskId, 
          backgroundColor: '#3b82f6', 
          borderColor: '#2563eb'
        }));

        setEvents(prev => [...prev, ...formattedEvents]);
        
        // 跳转逻辑：优先跳到单次事件的时间，如果是循环事件则不跳转
        if(formattedEvents[0].start) {
          calendarRef.current.getApi().gotoDate(formattedEvents[0].start);
        }
        setTaskName(''); 
        
      } else {
        // ========== 【分支二：长期项目调度 (保持之前的逻辑，补充红线)】 ==========
        if (!taskDDL || !estimatedHours) { alert("长期任务需要明确的 DDL 和预估耗时！"); return; }
        const searchStartDate = new Date(); 
        const searchEndDate = new Date(taskDDL); searchEndDate.setHours(23, 59, 59);

        // 这里的 findFreeSlots 已经帮你避开了已有日程
        const freeSlots = findFreeSlots(events, searchStartDate, searchEndDate, 1);
        if (freeSlots.length === 0) { alert("警告：在 DDL 之前已经没有空闲时间了！"); return; }

        const systemPrompt = `
        你是一个严谨的日程统筹 AI。你需要将长期任务切分，并放入提供的【绝对空闲时间池】中。
        高压红线规则：
        1. 睡眠禁区：任何切分的子任务，绝不允许安排在 01:00 到 07:30 之间！
        2. 你生成的子任务时间，必须 100% 包含在【空闲时间池】的 start 和 end 范围内。
        3. 每次子任务长度保持 1 到 2.5 小时。总耗时等于预估耗时。
        4. 只返回合法的 JSON 数组，不带任何 markdown。
        `;

        const userContext = `
        任务：${taskName}
        预估耗时：${estimatedHours} 小时
        可用的空闲时间池：
        ${JSON.stringify(freeSlots)}
        请开始拆解并分配！纯JSON返回。`;
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContext }
            ],
            temperature: 0.1 
          })
        });

        const data = await response.json();
        let aiResultStr = data.choices[0].message.content.trim();
        aiResultStr = aiResultStr.replace(/```json/g, '').replace(/```/g, '');
        const parsedSubTasks = JSON.parse(aiResultStr);

        const parentTask = { id: taskId, name: taskName, isLongTerm: true, ddl: taskDDL, estimatedHours: estimatedHours, status: 'active' };
        setTaskRegistry(prev => [...prev, parentTask]);

        const formattedEvents = parsedSubTasks.map(e => ({
          ...e, groupId: taskId, backgroundColor: '#f59e0b', borderColor: '#d97706'
        }));

        setEvents(prev => [...prev, ...formattedEvents]);
        calendarRef.current.getApi().gotoDate(formattedEvents[0].start);
        setTaskName(''); setTaskDDL(''); setEstimatedHours('');
      }
    } catch (error) {
      console.error("调度引擎发生错误:", error);
      alert("AI 规划失败。如果频繁报错，请检查它是不是又擅自加了 ```json 标记。");
    } finally {
      setIsThinking(false);
    }
  };
  // 🚀 终极杀器：全量动态重排引擎
  const handleRebalanceAll = async () => {
    setIsThinking(true);
    
    // 1. 提取“不可动”的护城河任务（课表、单次固定任务）
    const fixedEvents = events.filter(e => !e.groupId || !taskRegistry.find(t => t.id === e.groupId && t.isLongTerm));
    
    // 2. 提取需要重新洗牌的“弹性任务池”
    const flexibleTasks = taskRegistry.filter(t => t.isLongTerm && t.status === 'active');
    
    if (flexibleTasks.length === 0) {
      alert("当前没有活跃的长期任务需要重排。");
      setIsThinking(false);
      return;
    }

    // 3. 计算最远 DDL，划定重排的时间边界
    const maxDDL = new Date(Math.max(...flexibleTasks.map(t => new Date(t.ddl))));
    maxDDL.setHours(23, 59, 59);
    const searchStartDate = new Date();
    
    // 提取未来所有的空闲碎片
    const freeSlots = findFreeSlots(fixedEvents, searchStartDate, maxDDL, 0.5);

    // 4. 召唤大模型进行“高维统筹”
    const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const API_URL = "https://api.deepseek.com/chat/completions"; 

    const systemPrompt = `
    你是一个顶尖的学术时间管理大师。你的任务是将用户提供的【多个长期项目】重新分配到【空闲时间池】中。
    
    【核心法则】
    1. 优先级：DDL 越近的任务优先级越高，优先安排。
    2. 睡眠禁区：01:00 到 07:30 绝对禁止安排任何任务。
    3. 任务隔离：同一时间只能安排一个任务，绝不能重叠。
    4. 标签规范：生成的 title 必须包含原任务名和进度（如 "SCAS实验 (1/5)"）。
    5. 时间块：每个子任务长度保持 1 到 2.5 小时。
    
    只返回合法的 JSON 数组，包含所有重排后的子任务。绝不返回 markdown 标记。
    格式示例: [{"title": "任务A (1/3)", "start": "2026-04-29T09:00:00", "end": "2026-04-29T11:00:00", "groupId": "对应的原任务ID"}]
    `;

    const userContext = `
    【不可动的固定日程】(请绝对避开它们)：
    ${fixedEvents.map(e => `${e.title}: ${e.start || e.startTime}`).join('\n')}
    
    【需要你重新安排的长期任务】：
    ${JSON.stringify(flexibleTasks)}
    
    【可用的空闲时间池】：
    ${JSON.stringify(freeSlots)}
    `;

    try {
      showToast("开始重排", "AI 正在重新计算所有长期任务的最优路径...");
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContext }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      let aiResultStr = data.choices[0].message.content.trim();
      aiResultStr = aiResultStr.replace(/```json/g, '').replace(/```/g, '');
      const parsedSubTasks = JSON.parse(aiResultStr);

      // 5. 格式化并覆盖原有日历
      const formattedNewSubTasks = parsedSubTasks.map(e => ({
        ...e,
        backgroundColor: '#f59e0b', // 橙色代表长期任务
        borderColor: '#d97706'
      }));

      // 合并：固定任务 + 重新规划的长期任务
      setEvents([...fixedEvents, ...formattedNewSubTasks]);
      showToast("重排完成", "已根据优先级避开冲突并更新所有长期任务！");
      
    } catch (error) {
      console.error("重排引擎崩溃:", error);
      alert("重排失败，请检查控制台日志。");
    } finally {
      setIsThinking(false);
    }
  };
return (
    <div style={{ 
      padding: isMobile ? '10px' : '20px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      backgroundColor: '#f9fafb', 
      minHeight: '100vh' 
    }}>
      
      {/* 1. 顶部控制台 - 适配手机端换行 */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '15px', 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: '15px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: isMobile ? '20px' : '24px' }}>AI 校园助手系统</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>
              系统提醒: 
              <strong style={{ color: permission === 'granted' ? '#10b981' : '#ef4444', marginLeft: '5px' }}>
                {permission === 'granted' ? '🟢 已开启' : '🔴 未授权'}
              </strong>
            </p>
            {permission !== 'granted' && (
              <button onClick={requestPermission} style={{ padding: '4px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                开启通知
              </button>
            )}
          </div>
          {/* 在顶部控制台，紧挨着“开启通知”按钮的后面添加： */}
        <button 
          onClick={handleRebalanceAll} 
          disabled={isThinking}
          style={{ 
            padding: '4px 12px', 
            backgroundColor: isThinking ? '#9ca3af' : '#8b5cf6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: isThinking ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            marginLeft: '10px'
          }}
        >
          {isThinking ? '🔄 算力满载中...' : '🌟 AI 全局防冲突重排'}
        </button>
        </div>
        <button 
          onClick={() => setIsTaskManagerOpen(true)}
          style={{ padding: '6px 12px', backgroundColor: '#374151', color: 'white', borderRadius: '4px', border: 'none' }}
        >
          ⚙️ 任务管理
        </button>
        {/* 导入区 - 手机端占满宽度 */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '8px', 
          border: '1px dashed #d1d5db',
          width: isMobile ? '100%' : 'auto',
          boxSizing: 'border-box'
        }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#374151', fontWeight: 'bold' }}>
            导入 .ics 日历文件
          </label>
          <input 
            type="file" 
            accept=".ics" 
            onChange={handleFileUpload} 
            style={{ fontSize: '12px', width: '100%' }}
          />
        </div>
      </div>

      {/* 2. 睡眠控制台 - 手机端状态栏 */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '12px 15px', 
        backgroundColor: isSleeping ? '#1e293b' : '#f0fdf4', 
        borderRadius: '12px', 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        gap: '10px', 
        transition: 'all 0.5s' 
      }}>
        <div style={{ color: isSleeping ? '#f1f5f9' : '#166534', fontSize: '14px' }}>
          <strong>当前状态：</strong> {isSleeping ? '🌙 睡眠模式' : '☀️ 清醒模式'}
          {isSleeping && <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>({new Date(sleepStartTime).toLocaleTimeString()})</span>}
        </div>
        <button 
          onClick={isSleeping ? handleWakeUp : handleGoToSleep} 
          style={{ 
            padding: '6px 16px', 
            backgroundColor: isSleeping ? '#10b981' : '#64748b', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontSize: '13px',
            width: isMobile ? '100%' : 'auto'
          }}
        >
          {isSleeping ? '我起床了' : '开启睡眠模式'}
        </button>
      </div>

      {/* 3. 智能调度面板 */}
      <div style={{ 
        marginBottom: '15px', 
        padding: isMobile ? '15px' : '20px', 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        border: '1px solid #e5e7eb', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
          📐 智能任务规划
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#4b5563', marginBottom: '5px' }}>任务名称</label>
            <input 
              type="text" 
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="例如：准备信安赛报告"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsLongTerm(false)}
              style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid', backgroundColor: !isLongTerm ? '#eff6ff' : 'white', borderColor: !isLongTerm ? '#3b82f6' : '#d1d5db', color: !isLongTerm ? '#1d4ed8' : '#6b7280' }}
            >
              单次任务
            </button>
            <button 
              onClick={() => setIsLongTerm(true)}
              style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid', backgroundColor: isLongTerm ? '#eff6ff' : 'white', borderColor: isLongTerm ? '#3b82f6' : '#d1d5db', color: isLongTerm ? '#1d4ed8' : '#6b7280' }}
            >
              长期项目
            </button>
          </div>

          {isLongTerm && (
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row', 
              gap: '12px', 
              padding: '12px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px', 
              border: '1px dashed #d1d5db' 
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={taskDDL} onChange={(e) => setTaskDDL(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px' }}>预估耗时(h)</label>
                <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          <button 
            onClick={handleSmartSchedule}
            disabled={isThinking}
            style={{ 
              padding: '12px', 
              backgroundColor: isThinking ? '#9ca3af' : '#111827', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: 'bold',
              width: '100%',
              marginTop: '5px'
            }}
          >
            {isThinking ? 'AI 运筹帷幄中...' : '开始智能调度'}
          </button>
        </div>
      </div>

      {/* 4. 日历视图 - 手机端高度微调 */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: isMobile ? '10px' : '15px', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          views={{
            mobileThreeDay: {
              type: 'timeGrid',
              duration: { days: 3 },
              buttonText: '3天'
            }
          }}
          headerToolbar={{
            left: 'prev,next',
            center: 'title',
            right: isMobile ? 'timeGridDay,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          height={isMobile ? "60vh" : "70vh"}
          locale="zh-cn"
          events={events}
          handleWindowResize={true}
        />
      </div>
      {/* 任务管理面板 Modal */}
      {isTaskManagerOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>⚙️ 活跃任务管理</h3>
              <button onClick={() => setIsTaskManagerOpen(false)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            
            {taskRegistry.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center' }}>暂无未完成的任务</p>
            ) : (
              taskRegistry.map(task => (
                <div key={task.id} style={{ padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{task.name} <span style={{ fontSize: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>{task.isLongTerm ? '长期' : '单次'}</span></div>
                  
                  {/* 这里可以展开具体的编辑表单，类似模拟器中的逻辑 */}
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
                    原 DDL: {task.ddl} | 耗时: {task.estimatedHours}h
                  </div>
                  
                  <button onClick={() => {
                    // 【核心重排逻辑】
                    // 1. 删除旧日程
                    setEvents(prev => prev.filter(e => e.groupId !== task.id));
                    // 2. 从注册表中移除
                    setTaskRegistry(prev => prev.filter(t => t.id !== task.id));
                    // 3. 自动把参数填入主界面的表单，让用户修改后重新触发 handleSmartSchedule
                    setTaskName(task.name);
                    setIsLongTerm(task.isLongTerm);
                    if(task.isLongTerm){
                      setTaskDDL(task.ddl);
                      setEstimatedHours(task.estimatedHours);
                    }
                    setIsTaskManagerOpen(false);
                    showToast("进入重排模式", "旧日程已挂起，请在主表单修改参数后重新规划");
                  }} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    进入重新规划
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
  <h3 style={{ margin: 0 }}>⚙️ 任务管理</h3>
  <button 
    onClick={() => {
      if(window.confirm("确定要删除所有日程和任务吗？此操作不可逆。")) {
        setEvents([]);        // 清空日历显示
        setTaskRegistry([]);  // 清空任务档案
        localStorage.removeItem('campus_events');
        localStorage.removeItem('campus_tasks');
        showToast("系统清理", "所有历史测试数据已擦除");
        setIsTaskManagerOpen(false);
      }
    }}
    style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #ef4444', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
  >
    🔥 清空全部
  </button>
</div>

    </div>
  );
}

export default App;
