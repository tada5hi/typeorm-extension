import { setModuleLoader } from 'locter';

setModuleLoader({ load: (id) => import(id) });
