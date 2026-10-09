

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ipnznmrsjjuipaipsjku.supabase.co';
const supabaseKey = 'sb_publishable_d_e9gBpiJ8sZw3k1kzbo8Q_loi_3IPa';

export const supabase = createClient(supabaseUrl, supabaseKey);
