import {
  createContext,
  useContext,
  useState,
  ReactNode
} from 'react';

interface SelectedPatientContextType {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
}

const SelectedPatientContext = createContext<SelectedPatientContextType | undefined>(undefined);

export function SelectedPatientProvider({ children }: { children: ReactNode }) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  return (
    <SelectedPatientContext.Provider value={{ selectedPatientId, setSelectedPatientId }}>
      {children}
    </SelectedPatientContext.Provider>
  );
}

export function useSelectedPatient() {
  const context = useContext(SelectedPatientContext);
  if (!context) {
    throw new Error('useSelectedPatient must be used within SelectedPatientProvider');
  }
  return context;
}
