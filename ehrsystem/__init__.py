"""EHR subsystem package.

The package exposes the minimal in-memory implementation used for the current
story increment. It is intentionally small, explicit, and easy to trace from
the acceptance criteria back to the code.
"""

from .alerts import ProviderAlertService as ProviderAlertService
from .consent import ConsentWorkflowService as ConsentWorkflowService
from .dashboard import (
    UnifiedChronicDiseaseDashboardService as UnifiedChronicDiseaseDashboardService,
)
from .fixtures import (
    PSORIASIS_TRIGGER_CHECKLIST as PSORIASIS_TRIGGER_CHECKLIST,
)
from .fixtures import (
    is_valid_psoriasis_trigger as is_valid_psoriasis_trigger,
)
from .models import (
    AccessRequest as AccessRequest,
)
from .models import (
    Alert as Alert,
)
from .models import (
    CareTeamMember as CareTeamMember,
)
from .models import (
    DashboardSnapshot as DashboardSnapshot,
)
from .models import (
    DataCategorySyncStatus as DataCategorySyncStatus,
)
from .models import (
    EHRSystem as EHRSystem,
)
from .models import (
    MedicalRecordItem as MedicalRecordItem,
)
from .models import (
    MissingDataField as MissingDataField,
)
from .models import (
    Patient as Patient,
)
from .models import (
    Provider as Provider,
)
from .models import (
    ReportArtifact as ReportArtifact,
)
from .models import (
    SecureMessage as SecureMessage,
)
from .models import (
    SymptomLog as SymptomLog,
)
from .models import (
    SymptomTrendReport as SymptomTrendReport,
)
from .models import (
    SyncConflict as SyncConflict,
)
from .models import (
    Treatment as Treatment,
)
from .models import (
    Trigger as Trigger,
)
from .symptoms import SymptomLoggingService as SymptomLoggingService
from .sync import (
    CrossSystemSyncService as CrossSystemSyncService,
)
from .sync import (
    EHRProtocolAdapter as EHRProtocolAdapter,
)
from .sync import (
    EpicAdapter as EpicAdapter,
)
from .sync import (
    FHIRAdapter as FHIRAdapter,
)
from .sync import (
    HL7Adapter as HL7Adapter,
)
from .sync import (
    NextGenAdapter as NextGenAdapter,
)
