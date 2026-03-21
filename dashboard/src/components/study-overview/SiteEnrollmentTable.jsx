import { useState, useMemo } from 'react';
import { Building2, ChevronUp, ChevronDown } from 'lucide-react';
import Card from '../common/Card';
import { getPatientArms, pct } from '../../utils/fhirHelpers';

function buildSiteData(researchSubjects, patients) {
  const armMap = getPatientArms(researchSubjects);

  // Build a map of patient ref -> { orgRef, arm }
  const patientOrgMap = {};
  for (const p of patients) {
    const ref = `Patient/${p.id}`;
    patientOrgMap[ref] = {
      orgRef: p.managingOrganization?.reference || 'Unknown',
      orgName: p.managingOrganization?.display || p.managingOrganization?.reference || 'Unknown Site',
    };
  }

  // Aggregate by site
  const siteMap = {};
  for (const rs of researchSubjects) {
    const patRef = rs.individual?.reference || rs.subject?.reference;
    if (!patRef) continue;

    const patInfo = patientOrgMap[patRef] || { orgRef: 'Unknown', orgName: 'Unknown Site' };
    const arm = armMap[patRef] || 'Unknown';
    const armKey = arm.toUpperCase().includes('PEMBRO') ? 'PEMBRO' : 'CHEMO';
    const status = rs.status;

    if (!siteMap[patInfo.orgRef]) {
      siteMap[patInfo.orgRef] = {
        siteId: patInfo.orgRef.replace('Organization/', ''),
        siteName: patInfo.orgName,
        total: 0,
        PEMBRO: 0,
        CHEMO: 0,
        completed: 0,
      };
    }

    const site = siteMap[patInfo.orgRef];
    site.total++;
    site[armKey]++;
    if (status === 'completed' || status === 'off-study') {
      site.completed++;
    }
  }

  return Object.values(siteMap).map((s) => ({
    ...s,
    completionRate: pct(s.completed, s.total),
  }));
}

export default function SiteEnrollmentTable({ researchSubjects, patients }) {
  const [sortKey, setSortKey] = useState('total');
  const [sortAsc, setSortAsc] = useState(false);

  const siteData = useMemo(
    () => buildSiteData(researchSubjects, patients),
    [researchSubjects, patients]
  );

  const sorted = useMemo(() => {
    const copy = [...siteData];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [siteData, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const columns = [
    { key: 'siteId', label: 'Site ID' },
    { key: 'siteName', label: 'Site Name' },
    { key: 'total', label: 'Total' },
    { key: 'PEMBRO', label: 'PEMBRO' },
    { key: 'CHEMO', label: 'CHEMO' },
    { key: 'completionRate', label: 'Completion Rate' },
  ];

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return null;
    return sortAsc ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
    );
  };

  return (
    <Card title="Site Enrollment" icon={Building2}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                >
                  {col.label}
                  <SortIcon colKey={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No site data available
                </td>
              </tr>
            ) : (
              sorted.map((site) => (
                <tr
                  key={site.siteId}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{site.siteId}</td>
                  <td className="px-4 py-3 text-gray-800">{site.siteName}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{site.total}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {site.PEMBRO}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                      {site.CHEMO}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[100px]">
                        <div
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${Math.min(site.completionRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-12 text-right">
                        {site.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
