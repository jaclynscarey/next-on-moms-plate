-- Initial owned filament catalog. Display swatches are approximations.
-- Safe to run again: existing stock availability is preserved.
insert into public.filaments(id,name,brand,material,color,available) values
('f1100000-0000-4000-8000-000000000001','White','Insignia','PLA','#f5f5f0',true),
('f1100000-0000-4000-8000-000000000002','Black','Insignia','PLA','#242424',true),
('f1100000-0000-4000-8000-000000000003','Blue','Insignia','PLA','#2463bd',true),
('f1100000-0000-4000-8000-000000000004','Silk Gold','Insignia','Silk PLA','#cba64f',true),
('f1100000-0000-4000-8000-000000000005','Silk Silver','Insignia','Silk PLA','#b9bdc5',true),
('f1100000-0000-4000-8000-000000000006','Glow Rainbow','Insignia','PLA Glow','#c7d9a2',true),
('f1100000-0000-4000-8000-000000000007','Cosmic Purple','Insignia','PLA Glitter','#68468b',true),
('f1100000-0000-4000-8000-000000000008','Pink','Insignia','PLA','#ee86b3',true),
('f1100000-0000-4000-8000-000000000009','Coral Pink','Insignia','Matte PLA','#e78f89',true),
('f1100000-0000-4000-8000-000000000010','Red','Insignia','PLA','#ce343c',true),
('f1100000-0000-4000-8000-000000000011','Galaxy Green','Insignia','PLA Glitter','#386c54',true),
('f1100000-0000-4000-8000-000000000012','Jungle Green','Insignia','PLA','#426b37',true)
on conflict (id) do nothing;
