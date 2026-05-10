'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Protected } from '@/components/protected';
import { apiFetch } from '@/lib/api';

interface Cert {
  id: string;
  displayNo: number;
  certType: string;
  fullName: string;
  fullNameDat: string | null;
  birthDate: string;
  groupName: string;
  targetOrg: string;
}

interface Lookup {
  found: boolean;
  course?: number | null;
  gradYear?: number | null;
  enrollDate?: string;
  orderNumber?: string;
  specialty?: { canonicalName: string; code: string | null; durationMonths: number; durationHuman: string } | null;
}

export default function PrintMilitaryPage() {
  return (
    <Protected roles={['SUPERADMIN', 'ADM', 'COM']}>
      <PrintMilitary />
    </Protected>
  );
}

function PrintMilitary() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [cert, setCert] = useState<Cert | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<Cert>(`/api/certificates/${id}`).then(async (c) => {
      setCert(c);
      try {
        const l = await apiFetch<Lookup>('/api/lookup/order', { query: { fullName: c.fullName } });
        setLookup(l);
      } catch {
        setLookup({ found: false });
      }
    });
  }, [id]);

  if (!cert) return null;
  const today = new Date();
  const birth = parseISO(cert.birthDate);
  const enroll = lookup?.enrollDate ? parseISO(lookup.enrollDate) : null;
  const gradDate = lookup?.gradYear ? new Date(lookup.gradYear, 5, 30) : null;
  const specName = lookup?.specialty?.canonicalName ?? '08.02.05 Строительство и эксплуатация автомобильных дорог и аэродромов';
  const specCode = lookup?.specialty?.code ?? '';
  const duration = lookup?.specialty?.durationHuman ?? '3 года 10 месяцев';

  return (
    <>
      <PrintMilStyles />
      <div className="print-toolbar">
        <button onClick={() => window.close()} className="btn btn--ghost btn--sm" type="button">Закрыть</button>
        <button onClick={() => window.print()} className="btn btn--primary btn--sm" type="button">Печать</button>
        {!lookup?.found && (
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            Сведения о приказе, курсе и специальности подставлены по умолчанию — проверьте перед печатью.
          </span>
        )}
      </div>

      <div className="print-page-mil">
        <div className="wrapper">
          <table className="doc-table">
            <tbody>
              <tr>
                <td className="header-block">
                  <p className="header-line"><b>Министерство образования и науки</b></p>
                  <p className="header-line"><b>Забайкальского края</b></p>
                  <p className="header-line"><b>Государственное профессиональное образовательное</b></p>
                  <p className="header-line"><b>учреждение</b></p>
                  <p className="header-line"><b>«Читинский техникум отраслевых технологий</b></p>
                  <p className="header-line"><b>и бизнеса»</b></p>
                  <p className="header-line"><b>(ГПОУ ЧТОТиБ)</b></p>
                  <p className="header-line"><b>_________________</b></p>
                  <p className="header-line">Бабушкина ул., д. 66, Чита,</p>
                  <p className="header-line">Забайкальский край, 672000.</p>
                  <p className="header-line">Тел./факс: (302-2) 28-20-84, 28-20-83, 32-06-18</p>
                  <p className="header-line">E-mail: 101103@mail.ru; Chtotib@mail.ru</p>
                  <p className="header-line">ОКПО 01266421, ОГРН 1027501147134</p>
                  <p className="header-line">ИНН/КПП 7536009015/753601001</p>
                </td>
                <td className="header-block-right">
                  ПРИЛОЖЕНИЕ №4<br />
                  к Положению о призыве<br />
                  на военную службу граждан<br />
                  Российской Федерации
                </td>
              </tr>

              <tr>
                <td className="meta-row">
                  <span className="u u-mid"><b>{fmtDate(today)}</b></span>
                  &nbsp;№&nbsp;
                  <span className="u u-short"><b>С-{cert.displayNo}</b></span>
                </td>
                <td></td>
              </tr>

              <tr><td colSpan={2} className="title-row"><b>Справка</b></td></tr>

              <tr>
                <td colSpan={2} className="line mt-2 line-cell">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', padding: 0 }}>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Выдана гражданину&nbsp;
                        </td>
                        <td style={{ padding: 0, width: '100%' }}>
                          <span className="u u-full"><b>{cert.fullNameDat || cert.fullName}</b></span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr><td colSpan={2} className="line line-cell text-center small">(фамилия, имя, отчество)</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  <span className="u u-mid"><b>{birth ? fmtDate(birth) : '__.__.____'}</b></span>
                  &nbsp;года рождения, в том, что он (а) в&nbsp;
                  <span className="u u-mid"><b>{enroll ? fmtDate(enroll) : '__.__.____'}</b></span>
                  &nbsp;поступил (а), имея образование
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line line-cell text-center">
                  <span className="u u-full"><b>основное общее образование</b></span>
                </td>
              </tr>
              <tr><td colSpan={2} className="line line-cell text-center small">(уровень образования, в соответствии с которым гражданин принят на обучение в образовательную организацию)</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-center">
                  <span className="u u-full"><b>в ГПОУ «Читинский техникум отраслевых технологий и бизнеса»</b></span>
                </td>
              </tr>
              <tr><td colSpan={2} className="line line-cell text-center small">(полное наименование образовательной организации)</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  по имеющей государственную аккредитацию образовательной программе среднего профессионального образования
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line line-cell text-center">
                  <span className="u u-full"><b>{specCode ? `${specCode} ${specName}` : specName}</b></span>
                </td>
              </tr>
              <tr><td colSpan={2} className="line line-cell text-center small">(код и наименование направления подготовки или специальности среднего профессионального образования)</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  регистрационный №&nbsp;<span className="u u-mid"><b>A007-01052-75/01150744</b></span>
                  &nbsp;от <span className="u u-mid"><b>21.06.2018</b></span>
                  &nbsp;г., бессрочно выдана Министерством образования и науки Забайкальского края
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  В настоящее время обучается на&nbsp;<span className="u u-short"><b>{lookup?.course ?? '_'}</b></span>
                  &nbsp;курсе по очной форме обучения по направлению подготовки (специальности)
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line line-cell text-center">
                  <span className="u u-full"><b>{specCode ? `${specCode} ${specName}` : specName}</b></span>
                </td>
              </tr>
              <tr><td colSpan={2} className="line line-cell text-center small">(наименование профессии, специальности, направления подготовки)</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  Срок получения образования по образовательной программе среднего профессионального образования по очной форме обучения&nbsp;
                  <span className="u u-mid"><b>{duration}</b></span>.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  Окончание обучения в образовательной организации
                  «<span className="u u-mid"><b>{gradDate ? fmtDate(gradDate) : '30.06.____'}</b></span>» г.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify">
                  Справка выдана для предоставления в ВК&nbsp;
                  <span className="u u-long"><b>{cert.targetOrg || 'ВК ____________________________'}</b></span>
                </td>
              </tr>

              <tr className="sign-row">
                <td colSpan={2} className="line text-center">
                  Руководитель (заместитель руководителя)<br />образовательного учреждения
                </td>
              </tr>
              <tr className="sign-row">
                <td colSpan={2} className="line">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '15%', padding: 0 }}>М.П.</td>
                        <td style={{ width: '55%', padding: 0, textAlign: 'center' }}>
                          <span className="u" style={{ minWidth: 220 }}>&nbsp;</span>
                        </td>
                        <td style={{ width: '30%', padding: 0, textAlign: 'right' }}>Ж. В. Терукова</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* ── Нижний блок: военная подготовка + ВК + Начальник ВУЦ ── */}
              <tr><td colSpan={2} className="mt-2">&nbsp;</td></tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell text-justify small">
                  Заключил договор на обучение по программе военной подготовки офицера (солдата (матроса),
                  сержанта (старшины) запаса (военной подготовки в военном учебном центре) и приступил к обучению
                  с «<span className="u u-short"></span>»&nbsp;<span className="u u-short"></span>&nbsp;20<span className="u u-short"></span> г.
                  Окончание обучения «<span className="u u-short"></span>»&nbsp;<span className="u u-short"></span>&nbsp;20<span className="u u-short"></span> г.
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell small">
                  Аттестационный материал оформляет Военный комиссариат
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="line line-cell text-center small">
                  <span className="u u-full">&nbsp;</span>
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="line line-cell text-center small">
                  (наименование военного комиссариата муниципального образования (муниципальных образований))
                </td>
              </tr>

              <tr>
                <td colSpan={2} className="line mt-1 line-cell small">
                  <span className="u-full-left"><b>Начальник военного учебного центра</b></span>
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="line line-cell text-center small">
                  (воинское звание подпись, инициалы имени, фамилия)
                </td>
              </tr>

              <tr>
                <td className="line small">М.П.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PrintMilStyles() {
  return (
    <style jsx global>{`
      @page { size: A4; margin: 25mm 25mm 25mm 30mm; }
      .print-toolbar {
        position: sticky; top: 0; z-index: 10;
        display: flex; gap: var(--s-3); align-items: center;
        padding: var(--s-3) var(--s-4); background: var(--ais-veil);
        border-bottom: 1px solid var(--ais-line);
      }
      @media print { .print-toolbar, .app-shell aside, .app-shell .app-header { display: none !important; } }
      @media print { body, .app-main { background: #fff !important; color: #000 !important; padding: 0 !important; } }

      .print-page-mil {
        background: #fff; color: #000;
        font-family: "Times New Roman", serif; font-size: 11pt; line-height: 1.35;
        padding: 12mm 0 0;
      }
      .print-page-mil .wrapper { width: 840px; margin: 0 auto; }
      .print-page-mil .doc-table { width: 100%; border-collapse: collapse; border: none; font-size: 11pt; }
      .print-page-mil .doc-table td { border: none; padding: 0; vertical-align: bottom; font-size: 11pt; }
      .print-page-mil .header-block { width: 272px; padding: 0 5px 4mm 5px; }
      .print-page-mil .header-block-right { padding: 0 5px 4mm 5px; text-align: right; font-size: 9pt; vertical-align: top; }
      .print-page-mil .header-line { text-align: center; font-size: 9pt; margin: 0; }
      .print-page-mil .header-line + .header-line { margin-top: 1px; }
      .print-page-mil .u { display: inline-block; border-bottom: 1px solid #000; padding: 0 4px; line-height: 1.1; min-width: 30px; text-align: center; }
      .print-page-mil .u-long { min-width: 360px; text-align: center; }
      .print-page-mil .u-mid { min-width: 70px; }
      .print-page-mil .u-short { min-width: 30px; }
      .print-page-mil .u-full { width: 100%; box-sizing: border-box; }
      .print-page-mil .u-full-left {
        display: inline-block; width: 100%; box-sizing: border-box;
        border-bottom: 1px solid #000; padding: 0 4px; line-height: 1.1; text-align: left;
      }
      .print-page-mil .meta-row { font-size: 9pt; text-align: center; padding-top: 3mm; padding-bottom: 3mm; }
      .print-page-mil .title-row { padding-top: 3mm; padding-bottom: 5mm; text-align: center; font-weight: bold; font-size: 11pt; }
      .print-page-mil .line { font-size: 11pt; }
      .print-page-mil .text-justify { text-align: justify; }
      .print-page-mil .text-center { text-align: center; }
      .print-page-mil .mt-1 { margin-top: 4px; }
      .print-page-mil .mt-2 { margin-top: 8px; }
      .print-page-mil .line-cell { padding-top: 2px; }
      .print-page-mil .small { font-size: 9pt !important; }
      .print-page-mil .sign-row td { padding-top: 8mm; vertical-align: bottom; }
    `}</style>
  );
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function fmtDate(d: Date): string { return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
