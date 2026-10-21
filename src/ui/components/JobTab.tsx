import { useEffect, useRef, useState } from "react";
import { JOBS, JOB_PLAYSTYLE, SPECIALIZATIONS, jobRoute, type JobId, type SpecializationId } from "../../config/content";
import { availableJobs, canChangeJob, canRespecJob, changeJob, chooseSpecialization, respecJob, specializationReady } from "../../core/actions";
import { computeStats } from "../../core/stats";
import { fmt } from "../../core/format";
import { store, useGame } from "../store";
import { JOB_NAME, SKILL_NAME } from "../names";
import { Btn, Sprite } from "./common";
import { JobPreview } from "./JobPreview";
import { toast } from "./Toasts";

export function JobTab() {
  const s = useGame();
  const [selected, setSelected] = useState<JobId | null>(null);
  const [spec, setSpec] = useState<SpecializationId | null>(null);
  const [respec, setRespec] = useState(false);
  const selection = useRef<HTMLDivElement>(null);
  useEffect(() => { selection.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [selected, spec]);
  const cur = JOBS[s.job];
  const next = availableJobs(s);
  const before = computeStats(s);
  const after = selected ? computeStats({ ...s, job: selected, specialization: null }) : null;
  const specs = (Object.keys(SPECIALIZATIONS) as SpecializationId[]).filter((id) => SPECIALIZATIONS[id].job === s.job);
  const pick = (job: JobId, isRespec = false) => { setSelected(job); setSpec(null); setRespec(isRespec); };
  return <div className="job-tab">
    <div className="job-card current" style={{ ["--jc" as any]: cur.color }}>
      <div className="jc-name spec-head">{s.specialization && <Sprite name={`spec-${s.specialization}`} className="spec-icon" />}{JOB_NAME[s.job]}{s.specialization && ` · ${SPECIALIZATIONS[s.specialization].name}`}</div>
      <b>{JOB_PLAYSTYLE[jobRoute(s.job)].hook}</b>
      <div className="jc-desc">{s.specialization ? SPECIALIZATIONS[s.specialization].description : JOB_PLAYSTYLE[jobRoute(s.job)].mechanic}</div>
      <div className="jc-skill">技能：{SKILL_NAME[cur.skill.id]} · 自動施放</div>
      <Btn small color="purple" onClick={() => { setSelected(s.job); setSpec(s.specialization); setRespec(false); }}>試睇目前技能</Btn>
    </div>
    {next.map((job) => <div className="job-card" key={job} style={{ ["--jc" as any]: JOBS[job].color }}>
      <div className="jc-name">{JOB_NAME[job]}</div>
      <b>{JOB_PLAYSTYLE[jobRoute(job)].hook}</b>
      <div className="jc-desc">{JOB_PLAYSTYLE[jobRoute(job)].mechanic}</div>
      <div className="jc-skill">{SKILL_NAME[JOBS[job].skill.id]} · {JOBS[job].skill.hits} 段命中 · {JOBS[job].skill.cooldown} 秒冷卻</div>
      {JOBS[job].tier === 2 && <div className="jc-desc">升階後可揀兩種專精，今次轉生期間保留。</div>}
      <Btn color={canChangeJob(s, job) ? "gold" : "blue"} onClick={() => pick(job)}>{canChangeJob(s, job) ? "試睇及選擇" : `預覽 · Lv.${JOBS[job].unlockLevel} 解鎖`}</Btn>
    </div>)}
    {cur.tier === 1 && !s.jobRespecUsed && <div className="job-card">
      <b>第一次揀錯都唔怕 · 免費改選一次</b>
      <div className="jc-desc">只限一轉職業、Boss 戰以外使用；轉生唔會補回次數，生命比例同冷卻保留。</div>
      <div className="job-choices">{(["blade", "arcanist", "ranger"] as JobId[]).filter((j) => j !== s.job).map((j) => <Btn small key={j} color="blue" onClick={() => pick(j, true)}>試睇{JOB_NAME[j]}</Btn>)}</div>
    </div>}
    {specializationReady(s) && <div className="job-card">
      <div className="jc-name">揀你嘅二轉專精</div>
      <div className="jc-desc">二選一，今次轉生期間固定；轉生後可以重新揀。</div>
      {specs.map((id) => <div className="spec-option" key={id}><div className="spec-head"><Sprite name={`spec-${id}`} className="spec-icon" /><b>{SPECIALIZATIONS[id].name}</b></div><p>{SPECIALIZATIONS[id].description}</p><Btn small color="purple" onClick={() => { setSpec(id); setSelected(s.job); setRespec(false); }}>試睇{SPECIALIZATIONS[id].name}</Btn></div>)}
    </div>}
    {cur.tier === 2 && s.specialization && <div className="hint">專精已選定。下次轉生可以試另一套玩法。</div>}
    {selected && <div className="job-selection" ref={selection} key={`${selected}-${spec}`}>
      <JobPreview state={s} job={selected} specialization={spec} />
      {selected !== s.job && after && <div className="job-compare"><b>{JOB_NAME[s.job]} → {JOB_NAME[selected]}</b><span>攻擊 {fmt(before.atk)} → {fmt(after.atk)}</span><span>生命 {fmt(before.maxHp)} → {fmt(after.maxHp)}</span><span>攻速 {before.aps.toFixed(2)} → {after.aps.toFixed(2)}</span><small>職業倍率會配合你現有裝備；試睇後再決定。</small></div>}
      {selected !== s.job && <Btn wide color="gold" disabled={respec ? !canRespecJob(s, selected) : !canChangeJob(s, selected)} onClick={() => {
        const ok = store.act((g) => respec ? respecJob(g, selected) : changeJob(g, selected));
        if (ok) { setSelected(null); toast(`${respec ? "改選" : "轉職"}成為 ${JOB_NAME[selected]}！`); }
      }}>{respec ? "確認免費改選（僅一次）" : canChangeJob(s, selected) ? `確認轉職 · ${JOB_NAME[selected]}` : `Lv.${JOBS[selected].unlockLevel} 解鎖`}</Btn>}
      {selected === s.job && spec && specializationReady(s) && <Btn wide color="gold" onClick={() => {
        if (store.act((g) => chooseSpecialization(g, spec))) { toast(`專精已選：${SPECIALIZATIONS[spec].name}`); setSelected(null); }
      }}>確認專精 · {SPECIALIZATIONS[spec].name}</Btn>}
    </div>}
  </div>;
}
