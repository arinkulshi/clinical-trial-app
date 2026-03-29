import { createContext, useContext, useState, useEffect } from 'react';
import { fhirApi } from '../api/fhir';
import { extractEntries } from '../utils/fhirHelpers';

const StudyContext = createContext(null);

export function StudyProvider({ children }) {
  const [studies, setStudies] = useState([]);
  const [selectedStudyId, setSelectedStudyId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fhirApi.getStudies()
      .then((bundle) => {
        const entries = extractEntries(bundle);
        // Sort so "Phase III Randomized Open Label" study appears first
        entries.sort((a, b) => {
          const aMatch = /phase\s*III.*randomized.*open.?label/i.test(a.title || '');
          const bMatch = /phase\s*III.*randomized.*open.?label/i.test(b.title || '');
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
        setStudies(entries);
        if (entries.length > 0 && !selectedStudyId) {
          setSelectedStudyId(entries[0].id);
        }
      })
      .catch((err) => console.error('Failed to load studies:', err))
      .finally(() => setLoading(false));
  }, []);

  const selectedStudy = studies.find((s) => s.id === selectedStudyId) || null;

  return (
    <StudyContext.Provider value={{ studies, selectedStudy, selectedStudyId, setSelectedStudyId, loading }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudy must be used within a StudyProvider');
  return ctx;
}
