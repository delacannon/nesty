; ============================================================
; NESty generic engine (NROM, 32KB PRG, 8KB CHR)
; Rooms: 16x15 cells of 16x16px. Instant grid movement.
; States: 0 title, 1 walk, 2 dialog, 3 ending.
; Game data tables are appended by the compiler (data.asm).
; ============================================================

; ----- PPU / APU registers -----
PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
OAMADDR   = $2003
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014
JOY1      = $4016
SQ1_VOL   = $4000
SQ1_SWEEP = $4001
SQ1_LO    = $4002
SQ1_HI    = $4003
SQ2_VOL   = $4004
SQ2_SWEEP = $4005
SQ2_LO    = $4006
SQ2_HI    = $4007
TRI_LIN   = $4008
TRI_LO    = $400a
TRI_HI    = $400b
NOI_VOL   = $400c
NOI_LO    = $400e
NOI_HI    = $400f
APUSTATUS = $4015

; ----- sfx ids (must match compiler sfxgen.ts) -----
SFX_WALK   = 0
SFX_TALK   = 1
SFX_PICKUP = 2
SFX_EXIT   = 3
SFX_ENDING = 4
SFX_TYPE   = 5   ; typewriter per-char blip; custom sfx follow at 6+

; ----- pad bits (after 8x lsr/rol read loop) -----
BTN_A      = $80
BTN_B      = $40
BTN_SELECT = $20
BTN_START  = $10
BTN_UP     = $08
BTN_DOWN   = $04
BTN_LEFT   = $02
BTN_RIGHT  = $01

; ----- CHR layout (must match compiler layout.ts) -----
TILE_BLANK   = 0
BOX_TL = 1
BOX_T  = 2
BOX_TR = 3
BOX_L  = 4
BOX_C  = 5
BOX_R  = 6
BOX_BL = 7
BOX_B  = 8
BOX_BR = 9
TILE_ARROW = 10
SPR_TILE_ARROW = 0    ; sprite bank: dialog "more" arrow

; dialog palette (bg subpal 3 hijacked while a dialog is open)
PAL_BLACK  = $0f
PAL_GREY   = $00
PAL_WHITE  = $30
PAL_HILITE = $28      ; [col1] highlight (dialog color 2 slot, $3F0E)

; ----- states -----
ST_TITLE  = 0
ST_WALK   = 1
ST_DIALOG = 2
ST_ENDING = 3

; ----- dialog phases -----
DP_TYPE  = 0
DP_PAGE  = 1
DP_END   = 2
DP_BOX   = 3
DP_ERASE = 4
DP_CLEAR = 5

; ----- zero page -----
game_state   = $00
frame_ctr    = $01
pad          = $02
pad_prev     = $03
pad_pressed  = $04
cur_room     = $05
player_x     = $06
player_y     = $07
player_frame = $08
anim_frame   = $09
anim_timer   = $0a
ppuctrl_sh   = $0b
nmi_ready    = $0c
in_load      = $0d
ptr0         = $0e    ; ptr0+1 = $0f
ptr1         = $10    ; ptr1+1 = $11
room_ptr     = $12    ; $13
map_ptr      = $14    ; $15
dlg_ptr      = $18    ; $19
dlg_col      = $1a
dlg_phase    = $1b
dlg_sub      = $1c
dlg_row      = $1d
move_delay   = $1e
inv_count    = $1f
vbuf_len     = $20
dlg_base     = $21    ; box top nt row: 2 (top) or 24 (bottom), attr-quad aligned
dlg_tick     = $22    ; frames since last typewriter tick
ending_after = $23
need_release = $24
cur_dlg      = $25
tmp0         = $26
tmp1         = $27
tmp2         = $28
tmp3         = $29
tmp4         = $2a
tmp5         = $2b
exits_ptr    = $2c    ; $2d
end_ptr      = $2e    ; $2f
spr_ptr      = $30    ; $31
itm_ptr      = $32    ; $33
anim_ptr     = $34    ; $35
n_exits      = $36
n_endings    = $37
n_sprites    = $38
n_items      = $39
n_anim       = $3a
anim_idx     = $3b
target_x     = $3c
target_y     = $3d
target_pos   = $3e
found        = $3f    ; finder result
quad_ptr     = $40    ; $41
ms_x         = $42
ms_y         = $43
ms_attr      = $44
oam_off      = $45
nmi_tmp      = $46    ; NMI-only scratch (never touched by main thread)
sfx_ptr      = $47    ; $48
sfx_on       = $49
sfx_dur      = $4a
scroll_x     = $4b    ; PPUSCROLL shadows, applied every NMI (0 outside transitions)
scroll_y     = $4c
trans_par    = $4d    ; exit transition byte: 0 none, 1|dir<<2 scroll, 2 diag
trans_dir    = $4e    ; scroll direction 0 E, 1 W, 2 N, 3 S
trans_step   = $4f
trans_room   = $50    ; dest room during a transition
fade_pend    = $51    ; fade transition: load_room keeps palette black, fade-in follows
dlg_cycle    = $52    ; current dialog has [cycle] text: animate the highlight color
wave_n       = $53    ; wavy cells on the visible dialog page (cap 20)
wave_phase   = $54
; ----- music driver -----
mus_ptr      = $55    ; $56 — song blob (header + pitch tables)
mus_ord_ptr  = $57    ; $58
mus_pat_ptr  = $59    ; $5a — pattern data base of current song
mus_cur      = $5b    ; $5c — current pattern (pat_ptr + order[pos]*64)
mus_on       = $5d    ; 0 = off, else song index + 1
mus_fpr      = $5e    ; frames per row
mus_timer    = $5f
mus_step     = $60    ; 0-15
mus_ordpos   = $61
mus_ordlen   = $62
mus_lead     = $63    ; cached ctrl bytes
mus_mel      = $64
mus_drum     = $65
mus_tmp      = $66
; ----- logic (conds / events / overlays) -----
cond_op      = $67    ; cond_met scratch: op / comparator
cond_val     = $68    ; cond_met scratch: compare value
evt_ptr      = $69    ; $6a — current room's event list base
n_events     = $6b
evt_nact     = $6c    ; run_event: actions remaining
evt_pdlg     = $6d    ; run_event: pending dialog ($ff none)
ovl_ptr      = $6e    ; $6f — current room's overlay list base
ovl_n        = $70
ovl_pend_n   = $71    ; overlay cells awaiting nametable redraw
; ----- smooth (tweened) avatar movement -----
slide_x      = $72    ; signed px offset of avatar from its grid cell (-16..16)
slide_y      = $73
smooth_on    = $74    ; ram copy of move_smooth header byte
smooth_step  = $75    ; px/frame the slide advances (divides 16)
player_dir   = $76    ; facing: 0 down, 1 up, 2 left, 3 right
flip_on      = $77    ; ram copy of avatar_flip (mirror side art when left)
cont_on      = $78    ; ram copy of move_cont (glide continuously while held)
ms_xor       = $79    ; metasprite quadrant xor (1 hflip, 2 vflip, 3 both)
DIR_DOWN     = 0
DIR_UP       = 1
DIR_LEFT     = 2
DIR_RIGHT    = 3

; ----- RAM -----
oam_shadow  = $0200
vram_buf    = $0300   ; [hi lo len data...]* terminated by $ff, 96 bytes
                      ; (worst frame: dlg pal 10 + attr 19 + row 35 + $ff = 65)
row_buf     = $0360   ; 32-byte nametable row staging
item_flags  = $0380   ; 128-bit taken flags
item_counts = $0390   ; per item DEF: how many taken (conditions test != 0)
game_flags  = $03a0   ; 16 boolean flags, one byte each (0/1)
var_vals    = $03b0   ; 8 numeric variables
event_once  = $03c0   ; 128-bit fired flags for once-events
wave_list   = $0400   ; [nt hi, nt lo, pair base] × up to 20 wavy dialog cells
ovl_pend    = $0440   ; ≤16 cell positions with changed overlay tiles
spr_anim_ctl = $0460  ; per sprite DEF: 0 animate, 1 hold f0, 2 hold f1
anim_list   = $0480   ; ≤32 animated cell positions (rebuilt from map_ram)
map_ram     = $0500   ; 240-byte working tilemap (ROM map + overlays)

; ============================================================
reset:
  sei
  cld
  ldx #$40
  stx $4017
  ldx #$ff
  txs
  inx
  stx PPUCTRL
  stx PPUMASK
  stx $4010
@wait1:
  bit PPUSTATUS
  bpl @wait1
  txa
@clrram:
  sta $0000,x
  sta $0100,x
  sta $0200,x
  sta $0300,x
  sta $0400,x
  sta $0500,x
  sta $0600,x
  sta $0700,x
  inx
  bne @clrram
  ; hide all sprites
  lda #$fe
  ldx #0
@hidespr:
  sta oam_shadow,x
  inx
  inx
  inx
  inx
  bne @hidespr
@wait2:
  bit PPUSTATUS
  bpl @wait2

  ; splash screen replaces the text title when present
  lda has_splash
  beq @no_splash
  ; write_palette reads (room_ptr); point it at the splash palette
  lda #<splash_pal
  sta room_ptr
  lda #>splash_pal
  sta room_ptr+1
  jsr write_palette
  ; copy splash_nt + splash_attr (1024 contiguous bytes) to $2000-$23FF
  lda #<splash_nt
  sta ptr0
  lda #>splash_nt
  sta ptr0+1
  lda PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldx #4
@spl_page:
  ldy #0
@spl_byte:
  lda (ptr0),y
  sta PPUDATA
  iny
  bne @spl_byte
  inc ptr0+1
  dex
  bne @spl_page
  ; splash music (loops through the title; room byte takes over on start)
  lda splash_song
  cmp #$ff
  beq @no_spl_song
  jsr music_init
@no_spl_song:
  jmp @title_drawn
@no_splash:
  ; palette of the start room (title uses it too)
  lda start_room
  jsr room_ptr_set
  jsr write_palette

  jsr clear_nametable
  jsr draw_title
@title_drawn:

  ; enable pulse 1+2, triangle, noise (sfx + music)
  lda #$0f
  sta APUSTATUS
  lda #$08              ; sweep negate: guards low notes from sweep-mute
  sta SQ1_SWEEP
  sta SQ2_SWEEP
  lda #%10110000        ; duty 2, halt, constant vol 0 (silent)
  sta SQ1_VOL
  sta SQ2_VOL
  lda #$80              ; triangle: linear counter 0 = silent
  sta TRI_LIN
  lda #%00110000        ; noise silent
  sta NOI_VOL

  lda #ST_TITLE
  sta game_state
  lda #$ff
  sta vram_buf
  lda #%10001000        ; NMI on, BG at $0000, sprites at $1000
  sta ppuctrl_sh
  sta PPUCTRL
  jsr ppu_on

; ============================================================
main_loop:
  jsr read_pad
  lda game_state
  cmp #ST_TITLE
  beq @title
  cmp #ST_WALK
  beq @walk
  cmp #ST_DIALOG
  beq @dialog
  ; ST_ENDING: black screen, blinking THE END (input ignored)
  jsr st_ending
  jmp @present
@title:
  jsr st_title
  jmp @present
@walk:
  jsr st_walk
  jsr build_oam
  jmp @present
@dialog:
  jsr st_dialog
  jsr build_oam
@present:
  jsr music_tick
  jsr sfx_tick
  jsr wait_frame
  jmp main_loop

; ------------------------------------------------------------
; sound effects: pulse 1 note-stream driver
; stream: [ctrl, period_lo, period_hi|len, frames]* $ff
; ------------------------------------------------------------
; A = sfx index (clobbers X)
sfx_play:
  tax
  lda sfx_lo,x
  sta sfx_ptr
  lda sfx_hi,x
  sta sfx_ptr+1
  lda #1
  sta sfx_on
  sta sfx_dur           ; fetch first note on next tick
  rts

sfx_tick:
  lda sfx_on
  beq @ret
  dec sfx_dur
  bne @ret
  ; fetch next note
  ldy #0
  lda (sfx_ptr),y
  cmp #$ff
  beq @stop
  sta SQ1_VOL
  iny
  lda (sfx_ptr),y
  sta SQ1_LO
  iny
  lda (sfx_ptr),y
  sta SQ1_HI
  iny
  lda (sfx_ptr),y
  sta sfx_dur
  lda sfx_ptr
  clc
  adc #4
  sta sfx_ptr
  bcc @ret
  inc sfx_ptr+1
@ret:
  rts
@stop:
  lda #0
  sta sfx_on
  lda #%10110000        ; silence (constant vol 0)
  sta SQ1_VOL
  rts

; ============================================================
; music driver: 16-step patterns × 4 channels
; (lead=SQ1 shared with sfx, melody=SQ2, bass=TRI, drum=NOI)
; ============================================================
; A = song index; loads pointers + header, starts at order slot 0
; song blob offsets: 5/21 lead lo/hi, 37/53 melody, 69/85 bass, 101 noise
music_init:
  sta mus_tmp
  tax
  lda song_lo,x
  sta mus_ptr
  lda song_hi,x
  sta mus_ptr+1
  lda song_ord_lo,x
  sta mus_ord_ptr
  lda song_ord_hi,x
  sta mus_ord_ptr+1
  lda song_pat_lo,x
  sta mus_pat_ptr
  lda song_pat_hi,x
  sta mus_pat_ptr+1
  ldy #0
  lda (mus_ptr),y
  sta mus_fpr
  iny
  lda (mus_ptr),y
  sta mus_ordlen
  iny
  lda (mus_ptr),y
  sta mus_lead
  iny
  lda (mus_ptr),y
  sta mus_mel
  iny
  lda (mus_ptr),y
  sta mus_drum
  lda #0
  sta mus_step
  sta mus_ordpos
  lda #1
  sta mus_timer         ; first tick plays step 0
  lda mus_tmp
  clc
  adc #1
  sta mus_on            ; before set_pattern: it reuses mus_tmp as scratch
  jsr music_set_pattern
  rts

; mus_cur = mus_pat_ptr + order[mus_ordpos] * 64
music_set_pattern:
  ldy mus_ordpos
  lda (mus_ord_ptr),y
  sta mus_tmp
  lda #0
  asl mus_tmp
  rol a
  asl mus_tmp
  rol a                 ; mus_tmp:A = idx*4 (hi in A)
  asl mus_tmp
  rol a
  asl mus_tmp
  rol a
  asl mus_tmp
  rol a
  asl mus_tmp
  rol a                 ; idx*64 across mus_tmp (lo) : A (hi)
  sta mus_cur+1
  lda mus_tmp
  clc
  adc mus_pat_ptr
  sta mus_cur
  lda mus_cur+1
  adc mus_pat_ptr+1
  sta mus_cur+1
  rts

music_stop:
  lda #0
  sta mus_on
  lda sfx_on
  bne @sq2              ; sfx owns SQ1; it silences on its own end
  lda #%10110000
  sta SQ1_VOL
@sq2:
  lda #%10110000
  sta SQ2_VOL
  lda #$80
  sta TRI_LIN
  lda #%00110000
  sta NOI_VOL
  rts

music_tick:
  lda mus_on
  bne @run
  rts
@run:
  dec mus_timer
  beq @row
  rts
@row:
  lda mus_fpr
  sta mus_timer
  ; --- lead (pattern +0) -> SQ1, unless a sound effect owns it ---
  lda sfx_on
  bne @melody
  ldy mus_step
  lda (mus_cur),y
  beq @melody
  tax
  dex                   ; row 0-15
  lda mus_lead
  sta SQ1_VOL
  txa
  clc
  adc #5                ; pulse pitch lo table
  tay
  lda (mus_ptr),y
  sta SQ1_LO
  txa
  clc
  adc #21               ; pulse pitch hi table (|$08 baked in)
  tay
  lda (mus_ptr),y
  sta SQ1_HI            ; restarts the envelope
@melody:
  ; --- melody (pattern +16) -> SQ2 ---
  lda mus_step
  clc
  adc #16
  tay
  lda (mus_cur),y
  beq @bass
  tax
  dex
  lda mus_mel
  sta SQ2_VOL
  txa
  clc
  adc #37
  tay
  lda (mus_ptr),y
  sta SQ2_LO
  txa
  clc
  adc #53
  tay
  lda (mus_ptr),y
  sta SQ2_HI
@bass:
  ; --- bass (pattern +32) -> TRI: note-on sustains, rest silences ---
  lda mus_step
  clc
  adc #32
  tay
  lda (mus_cur),y
  beq @bassoff
  tax
  dex
  lda #$ff              ; linear counter max: sustain
  sta TRI_LIN
  txa
  clc
  adc #69               ; triangle pitch lo table
  tay
  lda (mus_ptr),y
  sta TRI_LO
  txa
  clc
  adc #85
  tay
  lda (mus_ptr),y
  sta TRI_HI
  jmp @drum
@bassoff:
  lda #$80
  sta TRI_LIN
@drum:
  ; --- drum (pattern +48) -> NOI ---
  lda mus_step
  clc
  adc #48
  tay
  lda (mus_cur),y
  beq @advance
  tax
  dex                   ; row 0-15
  lda mus_drum
  sta NOI_VOL
  txa
  clc
  adc #101              ; noise period table (mode bit baked in)
  tay
  lda (mus_ptr),y
  sta NOI_LO
  lda #$08
  sta NOI_HI            ; restart envelope + length
@advance:
  inc mus_step
  lda mus_step
  cmp #16
  bne @done
  lda #0
  sta mus_step
  inc mus_ordpos
  lda mus_ordpos
  cmp mus_ordlen
  bne @newpat
  lda #0
  sta mus_ordpos        ; song always loops
@newpat:
  jsr music_set_pattern
@done:
  rts

; ------------------------------------------------------------
wait_frame:
  ldx vbuf_len
  lda #$ff
  sta vram_buf,x        ; terminator
  lda #1
  sta nmi_ready
@spin:
  lda nmi_ready
  bne @spin
  lda #0
  sta vbuf_len
  lda #$ff
  sta vram_buf
  rts

; ------------------------------------------------------------
nmi:
  pha
  txa
  pha
  tya
  pha
  inc frame_ctr
  lda in_load
  bne @done             ; main thread owns the PPU
  lda nmi_ready
  beq @done
  ; OAM DMA
  lda #0
  sta OAMADDR
  lda #>oam_shadow
  sta OAMDMA
  ; drain vram buffer; entry hi-byte bit7 = +32 (column) write mode
  ldx #0
@entry:
  lda vram_buf,x
  cmp #$ff
  beq @drained
  tay
  and #$80
  beq @inc1
  lda ppuctrl_sh
  ora #$04              ; VRAM increment 32
  sta PPUCTRL
  jmp @setaddr
@inc1:
  lda ppuctrl_sh
  and #$fb              ; VRAM increment 1
  sta PPUCTRL
@setaddr:
  tya
  and #$3f
  sta PPUADDR
  inx
  lda vram_buf,x
  sta PPUADDR
  inx
  lda vram_buf,x        ; len
  inx
  sta nmi_tmp
@data:
  lda vram_buf,x
  sta PPUDATA
  inx
  dec nmi_tmp
  bne @data
  jmp @entry
@drained:
  ; scroll from shadows (0 outside transitions)
  lda PPUSTATUS
  lda ppuctrl_sh
  sta PPUCTRL
  lda scroll_x
  sta PPUSCROLL
  lda scroll_y
  sta PPUSCROLL
  lda #0
  sta nmi_ready
@done:
  pla
  tay
  pla
  tax
  pla
irq:
  rti

; ------------------------------------------------------------
read_pad:
  lda pad
  sta pad_prev
  lda #1
  sta JOY1
  lda #0
  sta JOY1
  ldx #8
@loop:
  lda JOY1
  lsr a
  rol pad
  dex
  bne @loop
  lda pad_prev
  eor #$ff
  and pad
  sta pad_pressed
  rts

; ------------------------------------------------------------
ppu_on:
  lda PPUSTATUS
  lda #0
  sta PPUSCROLL
  sta PPUSCROLL
  lda #%00011110        ; BG + sprites + left columns
  sta PPUMASK
  rts

; ============================================================
; STATE: title
; ============================================================
st_title:
  lda pad_pressed
  and #BTN_A|BTN_START
  beq @done
  ; variable initial values (flags/counters are zero from reset)
  ldx #7
@vinit:
  lda var_init,x
  sta var_vals,x
  dex
  bpl @vinit
  ; split start pos into x/y
  lda start_pos
  and #$0f
  sta player_x
  lda start_pos
  lsr a
  lsr a
  lsr a
  lsr a
  sta player_y
  ; smooth-movement config + reset tween
  lda move_smooth
  sta smooth_on
  lda move_step
  sta smooth_step
  lda move_cont
  sta cont_on
  lda avatar_flip
  sta flip_on
  lda #DIR_DOWN
  sta player_dir
  lda #0
  sta slide_x
  sta slide_y
  lda start_room
  jsr load_room
  lda #ST_WALK
  sta game_state
@done:
  rts

; ============================================================
; STATE: walk
; ============================================================
st_walk:
  jsr anim_tick
  jsr ovl_drain
  lda smooth_on
  bne @smooth
; ---- classic: instant grid-snap, edge press then autorepeat ----
  ; require d-pad release after an exit teleport
  lda need_release
  beq @free
  lda pad
  and #$0f
  bne @ret
  lda #0
  sta need_release
@free:
  lda pad_pressed
  and #$0f
  beq @held
  jsr dir_from_a
  lda #14
  sta move_delay
  jmp try_move
@held:
  lda pad
  and #$0f
  beq @ret
  dec move_delay
  bne @ret
  lda #8
  sta move_delay
  lda pad
  and #$0f
  jsr dir_from_a
  jmp try_move
@ret:
  rts

; ---- smooth: tween each tile; optionally glide on while a direction is held ----
@smooth:
  ; advance any in-progress tween; while still mid-tile, take no input
  lda slide_x
  ora slide_y
  beq @sgrid
  jsr slide_step
  bcs @ret              ; still sliding this frame
  ; fell through: the avatar just landed exactly on a grid cell
@sgrid:
  lda need_release
  beq @sfree
  lda pad
  and #$0f
  bne @ret
  lda #0
  sta need_release
@sfree:
  lda cont_on
  bne @scont
  ; --- per-tile: edge press then autorepeat, but each step tweens ---
  lda pad_pressed
  and #$0f
  beq @sheld
  jsr dir_from_a
  lda #14
  sta move_delay
  jmp try_move
@sheld:
  lda pad
  and #$0f
  beq @ret
  dec move_delay
  bne @ret
  lda #8
  sta move_delay
  lda pad
  and #$0f
  jsr dir_from_a
  jmp try_move
@scont:
  ; --- continuous: chain the next tile every frame the direction is held ---
  lda pad
  and #$0f
  beq @ret             ; released: stay put, settled on-grid
  jsr dir_from_a
  jmp try_move         ; seeds the next tween on a plain walk (seamless)

; A = dpad bits -> target_x/target_y (priority U,D,L,R)
dir_from_a:
  sta tmp0
  lda player_x
  sta target_x
  lda player_y
  sta target_y
  lda tmp0
  and #BTN_UP
  beq @notup
  dec target_y
  lda #DIR_UP
  sta player_dir
  rts
@notup:
  lda tmp0
  and #BTN_DOWN
  beq @notdown
  inc target_y
  lda #DIR_DOWN
  sta player_dir
  rts
@notdown:
  lda tmp0
  and #BTN_LEFT
  beq @notleft
  dec target_x
  lda #DIR_LEFT
  sta player_dir
  rts
@notleft:
  inc target_x
  lda #DIR_RIGHT
  sta player_dir
  rts

try_move:
  ; bounds
  lda target_x
  bmi @oob
  cmp #16
  bcs @oob
  lda target_y
  bmi @oob
  cmp #15
  bcc @inbounds
@oob:
  rts
@inbounds:
  ; pos byte
  lda target_y
  asl a
  asl a
  asl a
  asl a
  ora target_x
  sta target_pos

  ; --- sprite? ---
  jsr find_sprite
  bcc @nosprite
  ; pick alt dialog when its condition is met
  ldx found             ; sprite def index
  lda spr_conds,x
  cmp #$ff
  beq @sprbase
  jsr cond_met
  bcc @sprbase
  ldx found
  lda spr_alt_dlgs,x
  jmp @sprdlg
@sprbase:
  ldx found
  lda spr_dlgs,x
@sprdlg:
  cmp #$ff
  beq @sprsilent        ; silent sprite blocks
  pha
  lda #SFX_TALK
  jsr sfx_play
  pla
  jsr begin_dialog
@sprsilent:
  rts
@nosprite:
  ; --- item (not yet taken)? ---
  jsr find_item
  bcc @noitem
  ; (found = flag index, tmp4 = def index)
  jsr commit_move
  ; choose pickup dialog BEFORE counting this item
  ldx tmp4
  lda itm_conds,x
  cmp #$ff
  beq @itmbase
  jsr cond_met
  bcc @itmbase
  ldx tmp4
  lda itm_alt_dlgs,x
  jmp @itmdlg
@itmbase:
  ldx tmp4
  lda itm_dlgs,x
@itmdlg:
  sta tmp2              ; chosen dialog
  ldx found
  jsr set_item_flag
  ldx tmp4
  inc item_counts,x
  inc inv_count
  lda #SFX_PICKUP
  jsr sfx_play
  lda tmp2
  cmp #$ff
  beq @itmnodlg
  jsr begin_dialog
@itmnodlg:
  jsr logic_reeval      ; item counts changed: overlays may flip
  rts
@noitem:
  ; --- exit? ---
  jsr find_exit
  bcs @exithit
  jmp @noexit
@exithit:
  ; tmp3 = dest room, tmp4 = dest pos, tmp0 = req, tmp1 = locked dlg
  lda tmp0
  cmp #$ff
  beq @exitok
  jsr cond_met
  bcs @exitok
  ; locked: optional message, no move
  lda tmp1
  cmp #$ff
  beq @exitlocked
  pha
  lda #SFX_TALK
  jsr sfx_play
  pla
  jsr begin_dialog
@exitlocked:
  rts
@exitok:
  lda tmp4
  and #$0f
  sta player_x
  lda tmp4
  lsr a
  lsr a
  lsr a
  lsr a
  sta player_y
  lda tmp3
  sta trans_room
  ; trans byte: low nibble type (0 none, 1 scroll, 2 diag, 3 fade,
  ; 4 curtain, 5 blinds), high nibble scroll direction
  lda trans_par
  and #$0f
  beq @exitplain
  jsr hide_sprites
  lda trans_par
  and #$0f
  cmp #1
  bne @notscroll
  lda trans_par
  lsr a
  lsr a
  lsr a
  lsr a
  sta trans_dir
  jsr trans_scroll
  jmp @exitplain
@notscroll:
  cmp #2
  bne @notdiag
  jsr trans_wipe
  jmp @exitplain
@notdiag:
  cmp #3
  bne @notfade
  jsr trans_fade_out
  lda #1
  sta fade_pend
  jmp @exitplain
@notfade:
  cmp #4
  bne @notcurtain
  jsr trans_curtain
  jmp @exitplain
@notcurtain:
  jsr trans_blinds
@exitplain:
  lda trans_room
  jsr load_room
  lda fade_pend
  beq @nofadein
  jsr trans_fade_in
@nofadein:
  lda #1
  sta need_release
  lda #SFX_EXIT
  jsr sfx_play
  rts
@noexit:
  ; --- ending? ---
  jsr find_ending
  bcc @noending
  ; tmp3 = dlg, tmp0 = req, tmp1 = locked dlg
  lda tmp0
  cmp #$ff
  beq @endok
  jsr cond_met
  bcs @endok
  lda tmp1
  cmp #$ff
  beq @endlocked
  pha
  lda #SFX_TALK
  jsr sfx_play
  pla
  jsr begin_dialog
@endlocked:
  rts
@endok:
  jsr commit_move
  lda #1
  sta ending_after
  lda #SFX_ENDING
  jsr sfx_play
  lda tmp3              ; dialog index
  jsr begin_dialog
  rts
@noending:
  ; --- wall? ---
  ldy target_pos
  lda (map_ptr),y
  tax
  lda tile_flags,x
  and #1
  bne @blocked
  jsr seed_slide       ; smooth: start old->new tween (pre-snap, plain walk only)
  jsr commit_move
@runevt:
  ; --- event on the entered (or bumped) cell? ---
  jsr find_event
  bcc @ret
  jsr run_event
@ret:
  rts
@blocked:
  ; solid wall: still fire an event on it when the player bumps into it,
  ; from any side. Edge press only (pad_pressed), so holding into the wall
  ; doesn't re-trigger every autorepeat tick.
  lda pad_pressed
  and #$0f
  bne @runevt
  rts

commit_move:
  lda target_x
  sta player_x
  lda target_y
  sta player_y
  lda player_frame
  eor #1
  sta player_frame
  lda #SFX_WALK         ; pickup/ending override this same frame
  jmp sfx_play

; Seed a tween so the avatar starts at its OLD cell and slides to the new one.
; Call BEFORE commit_move (while player_x/y still hold the old cell).
; slide = (old - new) * 16: right/down negative, left/up positive. delta ∈ -1..1
; so a 4× asl of the two's-complement delta yields the correct signed offset.
seed_slide:
  lda smooth_on
  bne @go
  rts
@go:
  lda player_x
  sec
  sbc target_x
  asl a
  asl a
  asl a
  asl a
  sta slide_x
  lda player_y
  sec
  sbc target_y
  asl a
  asl a
  asl a
  asl a
  sta slide_y
  rts

; Advance the active tween one step toward 0 by smooth_step. Only one axis is
; ever nonzero (movement is orthogonal). Returns C=1 if still sliding after the
; step, C=0 the frame it settles on-grid — so the caller can chain the next tile
; with no visible pause while a direction is held.
slide_step:
  lda slide_x
  bne @dox
  lda slide_y
  bne @doy
  clc                  ; already settled
  rts
@dox:
  bpl @xpos
  clc                  ; negative: add toward 0
  adc smooth_step
  bmi @xset            ; still negative
  lda #0               ; overshot: clamp on-grid
  jmp @xset
@xpos:
  sec                  ; positive: subtract toward 0
  sbc smooth_step
  bpl @xset            ; still >= 0
  lda #0
@xset:
  sta slide_x
  bne @moving
  clc                  ; landed this frame
  rts
@doy:
  bpl @ypos
  clc
  adc smooth_step
  bmi @yset
  lda #0
  jmp @yset
@ypos:
  sec
  sbc smooth_step
  bpl @yset
  lda #0
@yset:
  sta slide_y
  bne @moving
  clc
  rts
@moving:
  sec
  rts

; ------------------------------------------------------------
; finders: scan current room lists for target_pos.
; ------------------------------------------------------------
; sprites: entries {pos, def, appear_cond}. C=1 & found=def when hit.
; Sprites whose appear cond is unmet are absent (no talk, no block).
find_sprite:
  ldy #0
  ldx n_sprites
  beq @miss
@loop:
  lda (spr_ptr),y
  cmp target_pos
  beq @hit
@next:
  iny
  iny
  iny
  dex
  bne @loop
@miss:
  clc
  rts
@hit:
  sty tmp3
  stx tmp1
  iny
  iny
  lda (spr_ptr),y       ; appear cond
  cmp #$ff
  beq @vis
  jsr cond_met
  bcs @vis
  ldx tmp1
  ldy tmp3
  jmp @next
@vis:
  ldy tmp3
  iny
  lda (spr_ptr),y
  sta found
  sec
  rts

; items: entries {pos, def, flag, appear_cond}. Skips taken and hidden.
; On hit: found = flag index, tmp4 = def index.
find_item:
  ldy #0
  ldx n_items
  beq @miss
@loop:
  lda (itm_ptr),y
  cmp target_pos
  beq @maybe
@next:
  iny
  iny
  iny
  iny
  dex
  bne @loop
@miss:
  clc
  rts
@maybe:
  sty tmp3
  stx tmp1
  iny
  iny
  lda (itm_ptr),y       ; flag index
  jsr get_item_flag
  bne @skip
  iny
  lda (itm_ptr),y       ; appear cond
  cmp #$ff
  beq @present
  jsr cond_met
  bcs @present
@skip:
  ldx tmp1
  ldy tmp3
  jmp @next
@present:
  ldy tmp3
  iny
  lda (itm_ptr),y       ; def index
  sta tmp4
  iny
  lda (itm_ptr),y       ; flag index
  sta found
  sec
  rts

; exits: entries {pos, dest_room, dest_pos, req, locked_dlg, trans}
; -> tmp3 = dest room, tmp4 = dest pos, tmp0 = req, tmp1 = locked dlg,
;    trans_par = transition byte
find_exit:
  ldy #0
  ldx n_exits
  beq @miss
@loop:
  lda (exits_ptr),y
  cmp target_pos
  beq @hit
  iny
  iny
  iny
  iny
  iny
  iny
  dex
  bne @loop
@miss:
  clc
  rts
@hit:
  iny
  lda (exits_ptr),y
  sta tmp3
  iny
  lda (exits_ptr),y
  sta tmp4
  iny
  lda (exits_ptr),y
  sta tmp0
  iny
  lda (exits_ptr),y
  sta tmp1
  iny
  lda (exits_ptr),y
  sta trans_par
  sec
  rts

; endings: entries {pos, dlg, req, locked_dlg}
; -> tmp3 = dlg, tmp0 = req, tmp1 = locked dlg
find_ending:
  ldy #0
  ldx n_endings
  beq @miss
@loop:
  lda (end_ptr),y
  cmp target_pos
  beq @hit
  iny
  iny
  iny
  iny
  dex
  bne @loop
@miss:
  clc
  rts
@hit:
  iny
  lda (end_ptr),y
  sta tmp3
  iny
  lda (end_ptr),y
  sta tmp0
  iny
  lda (end_ptr),y
  sta tmp1
  sec
  rts

; ------------------------------------------------------------
; item taken flags
; ------------------------------------------------------------
; A = flag index; returns A != 0 if taken (Y preserved)
get_item_flag:
  sty tmp5
  pha
  lsr a
  lsr a
  lsr a
  tay
  lda item_flags,y
  sta tmp2
  pla
  and #7
  tay
  lda bit_mask,y
  ldy tmp5
  and tmp2              ; last: Z flag must survive the ldy restore
  rts

; X = flag index
set_item_flag:
  txa
  lsr a
  lsr a
  lsr a
  tay
  txa
  and #7
  tax
  lda bit_mask,x
  ora item_flags,y
  sta item_flags,y
  rts

; A = once-event index; returns A != 0 if already fired (clobbers A, Y, tmp2)
get_once_flag:
  pha
  lsr a
  lsr a
  lsr a
  tay
  lda event_once,y
  sta tmp2
  pla
  and #7
  tay
  lda bit_mask,y
  and tmp2
  rts

; X = once-event index
set_once_flag:
  txa
  lsr a
  lsr a
  lsr a
  tay
  txa
  and #7
  tax
  lda bit_mask,x
  ora event_once,y
  sta event_once,y
  rts

bit_mask:
  .byte $01,$02,$04,$08,$10,$20,$40,$80

; ------------------------------------------------------------
; conditions: A = index into cond_table (3-byte records {op, idx, value});
; $ff = no condition (met). op: 1-4 item count GE/LT/EQ/NE vs value,
; 5 flag set, 6 flag clear, 7-10 var GE/LT/EQ/NE vs value.
; -> C set if met. Clobbers A, X, Y, ptr1, cond_op, cond_val, tmp5.
; (Callers keep live data in tmp0-tmp4 — do not touch those here.)
; ------------------------------------------------------------
cond_met:
  cmp #$ff
  bne @chk
  sec
  rts
@chk:
  ; ptr1 = cond_table + A*3 (16-bit: index can exceed 85)
  sta tmp5
  lda #0
  sta ptr1+1
  lda tmp5
  asl a
  rol ptr1+1
  clc
  adc tmp5
  bcc @noc
  inc ptr1+1
@noc:
  clc
  adc #<cond_table
  sta ptr1
  lda ptr1+1
  adc #>cond_table
  sta ptr1+1
  ldy #0
  lda (ptr1),y
  sta cond_op
  iny
  lda (ptr1),y
  tax
  iny
  lda (ptr1),y
  sta cond_val
  lda cond_op
  cmp #5
  bcc @item             ; 1-4: item count
  cmp #7
  bcc @flag             ; 5-6: flag
  ; var compare: comparator = op - 7
  sec
  sbc #7
  sta cond_op
  lda var_vals,x
  jmp @cmp
@item:
  ; comparator = op - 1
  sec
  sbc #1
  sta cond_op
  lda item_counts,x
  jmp @cmp
@flag:
  lda game_flags,x      ; 0 or 1
  ldy cond_op
  cpy #6
  bne @flagtest
  eor #1                ; clear-test
@flagtest:
  cmp #1                ; C set when flag test passes
  rts
@cmp:
  ; comparator in cond_op: 0 GE, 1 LT, 2 EQ, 3 NE; A vs cond_val
  cmp cond_val
  bcc @lt
  beq @eq
  ; A > value: GE and NE are true
  lda cond_op
  cmp #0
  beq @met
  cmp #3
  beq @met
  bne @unmet
@eq:
  ; A == value: GE and EQ are true
  lda cond_op
  cmp #0
  beq @met
  cmp #2
  beq @met
  bne @unmet
@lt:
  ; A < value: LT and NE are true
  lda cond_op
  cmp #1
  beq @met
  cmp #3
  beq @met
@unmet:
  clc
  rts
@met:
  sec
  rts

; ============================================================
; STATE: dialog
; ============================================================
; A = dialog index.
; 4-row box: border, line 1, line 2, border. Line 2 uses the 1px-shifted
; font copy so the lines sit 2px apart.
; Bottom (nt rows 24..27) unless player is past the screen middle,
; then top (rows 2..5). Both keep the attr rows quad-aligned.
begin_dialog:
  sta cur_dlg
  ldx #24
  lda player_y
  cmp #8                ; rooms are 15 cells; >=8 = bottom half
  bcc @pos
  ldx #2
@pos:
  stx dlg_base
  lda #ST_DIALOG
  sta game_state
  lda #DP_BOX
  sta dlg_phase
  lda #0
  sta dlg_sub
  sta dlg_tick
  sta dlg_cycle
  rts

st_dialog:
  jsr dlg_wave_tick
  ; animate the highlight palette entry: 1 = [cycle] hue rotation,
  ; 2 = [blink] white/black toggle
  lda dlg_cycle
  beq @nocyc
  cmp #2
  beq @blink
  lda frame_ctr
  and #7
  bne @nocyc
  lda frame_ctr
  lsr a
  lsr a
  lsr a
  and #3
  tax
  lda cycle_colors,x
  jmp @wr
@blink:
  lda frame_ctr
  and #15
  bne @nocyc
  lda frame_ctr
  and #16               ; 16 frames on, 16 off
  beq @bl_off
  lda #PAL_WHITE
  jmp @wr
@bl_off:
  lda #PAL_BLACK
@wr:
  pha
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$0e              ; dialog color 2 slot
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  pla
  sta vram_buf,x
  inx
  stx vbuf_len
@nocyc:
  ldx dlg_phase
  lda dlg_jump_lo,x
  sta ptr1
  lda dlg_jump_hi,x
  sta ptr1+1
  jmp (ptr1)

cycle_colors:
  .byte $28,$16,$2a,$21 ; gold, red, green, blue

; [wave] cells: every 8 frames re-point each cell at pair base / base+1
; with a per-cell phase offset (traveling bob). Only runs on frames where
; the vram buffer is empty, so it never fights the typewriter.
dlg_wave_tick:
  lda wave_n
  beq @done
  lda vbuf_len
  bne @done
  lda frame_ctr
  and #7
  bne @done
  inc wave_phase
  lda #0
  sta tmp4              ; cell index
  sta tmp5              ; list offset (i*3)
  ldx vbuf_len
@cell:
  ldy tmp5
  lda wave_list,y
  sta vram_buf,x
  inx
  lda wave_list+1,y
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  lda wave_phase
  clc
  adc tmp4
  and #3
  tay
  lda wave_off,y
  ldy tmp5
  clc
  adc wave_list+2,y
  sta vram_buf,x
  inx
  lda tmp5
  clc
  adc #3
  sta tmp5
  inc tmp4
  lda tmp4
  cmp wave_n
  bne @cell
  stx vbuf_len
@done:
  rts

wave_off:
  .byte 0,1,1,0

; indexed by dialog phase: TYPE PAGE END BOX ERASE CLEAR
dlg_jump_lo:
  .byte <dlg_type, <dlg_page, <dlg_endwait, <dlg_box, <dlg_erase, <dlg_clear
dlg_jump_hi:
  .byte >dlg_type, >dlg_page, >dlg_endwait, >dlg_box, >dlg_erase, >dlg_clear

; draw one box row per frame (nt rows dlg_base..dlg_base+3)
; first frame also flips palette/attributes to the dialog b/w palette
dlg_box:
  lda dlg_sub
  bne @row
  jsr queue_dlg_pal
  jsr queue_dlg_attr
@row:
  lda dlg_sub
  jsr build_box_row
  lda dlg_sub
  clc
  adc dlg_base
  jsr queue_row
  inc dlg_sub
  lda dlg_sub
  cmp #4
  bne @ret
  ; box done: start typing
  ldx cur_dlg
  lda dlg_lo,x
  sta dlg_ptr
  lda dlg_hi,x
  sta dlg_ptr+1
  jsr reset_text_cursor
  lda #DP_TYPE
  sta dlg_phase
@ret:
  rts

reset_text_cursor:
  lda dlg_base
  clc
  adc #1
  sta dlg_row
  lda #2
  sta dlg_col
  lda #0
  sta wave_n            ; wavy cells belong to the visible page
  rts

; typewriter: every text_delay frames, type text_chars chars
; (both emitted by the compiler from the game's TEXT speed setting)
dlg_type:
  lda text_delay
  beq @tick
  inc dlg_tick
  lda dlg_tick
  cmp text_delay
  bcs @tick
  rts
@tick:
  lda #0
  sta dlg_tick
  lda text_chars
  sta tmp0
@next:
  ldy #0
  lda (dlg_ptr),y
  bne @notend
  lda #DP_END
  sta dlg_phase
  rts
@notend:
  cmp #1
  bne @notnl
  jsr inc_dlg_ptr
  lda dlg_base
  clc
  adc #2                ; line 2
  sta dlg_row
  lda #2
  sta dlg_col
  jmp @cont
@notnl:
  cmp #2
  bne @notpg
  jsr inc_dlg_ptr
  lda #DP_PAGE
  sta dlg_phase
  rts
@notpg:
  cmp #3                ; [cycle] marker: animate highlight while dialog open
  bne @notcyc
  jsr inc_dlg_ptr
  lda #1
  sta dlg_cycle
  jmp @cont
@notcyc:
  cmp #4                ; [blink] marker: toggle highlight visibility
  bne @char
  jsr inc_dlg_ptr
  lda #2
  sta dlg_cycle
  jmp @cont
@char:
  ; line-2 chars already carry their 1px-shifted tile from the compiler
  jsr put_char
  jsr inc_dlg_ptr
  inc dlg_col
  lda tw_sfx            ; per-char typewriter blip (compiler flag)
  beq @cont
  lda #SFX_TYPE
  jsr sfx_play
@cont:
  dec tmp0
  bne @next
  rts

inc_dlg_ptr:
  inc dlg_ptr
  bne @ret
  inc dlg_ptr+1
@ret:
  rts

; queue single char (A) at dlg_row/dlg_col
put_char:
  sta tmp4
  lda dlg_row
  jsr nt_row_addr       ; tmp1=hi tmp2=lo
  lda tmp2
  clc
  adc dlg_col
  sta tmp2
  ldx vbuf_len
  lda tmp1
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  lda tmp4
  sta vram_buf,x
  inx
  stx vbuf_len
  ; wave glyph (by CHR range)? remember its cell for the animator
  lda tmp4
  cmp wave_first
  bcc @nowave
  cmp wave_end
  bcs @nowave
  ldx wave_n
  cpx #20
  bcs @nowave
  ; y = n*3
  txa
  asl a
  clc
  adc wave_n
  tay
  lda tmp1
  sta wave_list,y
  lda tmp2
  sta wave_list+1,y
  lda tmp4
  and #$fe              ; even pair base
  sta wave_list+2,y
  inc wave_n
@nowave:
  rts

; queue dialog palette: bg subpal 3 = black fill / white text,
; spr subpal 3 color 3 = white (bobbing arrow)
queue_dlg_pal:
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$0d
  sta vram_buf,x
  inx
  lda #3
  sta vram_buf,x
  inx
  lda #PAL_BLACK
  sta vram_buf,x
  inx
  lda #PAL_HILITE       ; color 2: [col1]/[cycle] highlight ink
  sta vram_buf,x
  inx
  lda #PAL_WHITE
  sta vram_buf,x
  inx
  lda #$3f
  sta vram_buf,x
  inx
  lda #$1f
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  lda #PAL_WHITE
  sta vram_buf,x
  inx
  stx vbuf_len
  rts

; restore room palette values for the hijacked slots
queue_room_pal:
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$0d
  sta vram_buf,x
  inx
  lda #3
  sta vram_buf,x
  inx
  ldy #13               ; room record: bg subpal 3 colors at 13..15
@bg:
  lda (room_ptr),y
  sta vram_buf,x
  inx
  iny
  cpy #16
  bne @bg
  lda #$3f
  sta vram_buf,x
  inx
  lda #$1f
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  ldy #31               ; spr subpal 3 color 3
  lda (room_ptr),y
  sta vram_buf,x
  inx
  stx vbuf_len
  rts

; ptr1 -> room attribute table (room_ptr + 272)
attr_ptr_set:
  lda room_ptr
  clc
  adc #<272
  sta ptr1
  lda room_ptr+1
  adc #>272
  sta ptr1+1
  rts

; box attr coverage:
;   top (rows 2..5): $23C0 16 bytes - bottom quads of attr row 0 (|$F0)
;                    plus top quads of attr row 1 (|$0F)
;   bottom (rows 24..27): $23F0 8 bytes - whole attr row 6 ($FF)
queue_dlg_attr:
  jsr attr_ptr_set
  ldx vbuf_len
  lda #$23
  sta vram_buf,x
  inx
  lda dlg_base
  cmp #24
  beq @bottom
  lda #$c0
  sta vram_buf,x
  inx
  lda #16
  sta vram_buf,x
  inx
  ldy #0
@t0:
  lda (ptr1),y
  ora #$f0
  sta vram_buf,x
  inx
  iny
  cpy #8
  bne @t0
@t1:
  lda (ptr1),y
  ora #$0f
  sta vram_buf,x
  inx
  iny
  cpy #16
  bne @t1
  stx vbuf_len
  rts
@bottom:
  lda #$f0
  sta vram_buf,x
  inx
  lda #8
  sta vram_buf,x
  inx
  lda #$ff              ; palette 3 in every quadrant
  ldy #8
@fill:
  sta vram_buf,x
  inx
  dey
  bne @fill
  stx vbuf_len
  rts

queue_room_attr:
  jsr attr_ptr_set
  ldx vbuf_len
  lda #$23
  sta vram_buf,x
  inx
  lda dlg_base
  cmp #24
  beq @bottom
  lda #$c0
  sta vram_buf,x
  inx
  lda #16
  sta vram_buf,x
  inx
  ldy #0
@copy16:
  lda (ptr1),y
  sta vram_buf,x
  inx
  iny
  cpy #16
  bne @copy16
  stx vbuf_len
  rts
@bottom:
  lda #$f0
  sta vram_buf,x
  inx
  lda #8
  sta vram_buf,x
  inx
  ldy #48
@copy8:
  lda (ptr1),y
  sta vram_buf,x
  inx
  iny
  cpy #56
  bne @copy8
  stx vbuf_len
  rts

dlg_page:
  lda pad_pressed
  and #BTN_A|BTN_START
  beq @ret
  lda #DP_CLEAR
  sta dlg_phase
  lda #0
  sta dlg_sub
@ret:
  rts

; clear one text row per frame (rows dlg_base+1, +2), then resume typing
dlg_clear:
  ldx #1                ; interior row pattern
  jsr build_box_row_x
  lda dlg_sub
  clc
  adc dlg_base
  adc #1
  jsr queue_row
  inc dlg_sub
  lda dlg_sub
  cmp #2
  bne @ret
  jsr reset_text_cursor
  lda #DP_TYPE
  sta dlg_phase
@ret:
  rts

dlg_endwait:
  lda pad_pressed
  and #BTN_A|BTN_START
  beq @ret
  lda #DP_ERASE
  sta dlg_phase
  lda #0
  sta dlg_sub
@ret:
  rts

; restore one covered nametable row per frame (dlg_base..dlg_base+3);
; last frame also restores the room palette + attributes
dlg_erase:
  lda dlg_sub
  clc
  adc dlg_base
  jsr draw_nt_row
  lda dlg_sub
  clc
  adc dlg_base
  jsr queue_row
  inc dlg_sub
  lda dlg_sub
  cmp #4
  bne @ret
  jsr queue_room_pal
  jsr queue_room_attr
  lda ending_after
  bne @ending
  lda #ST_WALK
  sta game_state
  rts
@ending:
  jsr begin_ending
@ret:
  rts

; build box row A (0=top,1/2=interior,3=bottom) into row_buf
build_box_row:
  tax
  lda box_row_type,x
  tax
build_box_row_x:
  ; X: 0 top, 1 interior, 2 bottom
  lda box_left,x
  sta row_buf
  lda box_mid,x
  ldy #1
@fill:
  sta row_buf,y
  iny
  cpy #31
  bne @fill
  lda box_right,x
  sta row_buf+31
  rts

box_row_type:
  .byte 0, 1, 1, 2
box_left:
  .byte BOX_TL, BOX_L, BOX_BL
box_mid:
  .byte BOX_T, BOX_C, BOX_B
box_right:
  .byte BOX_TR, BOX_R, BOX_BR

; ============================================================
; tile animation (walk state only)
; ============================================================
anim_tick:
  inc anim_timer
  lda anim_timer
  cmp #32
  bcc @walker
  lda #0
  sta anim_timer
  lda anim_frame
  eor #1
  sta anim_frame
  lda n_anim
  beq @walker
  lda #0
  sta anim_idx
@walker:
  lda anim_idx
  cmp #$ff
  beq @ret
  ; up to 4 cells per frame
  lda #4
  sta tmp0
@cell:
  ldy anim_idx
  cpy n_anim
  bcc @doit
  lda #$ff
  sta anim_idx
  rts
@doit:
  lda (anim_ptr),y
  jsr queue_cell
  inc anim_idx
  dec tmp0
  bne @cell
@ret:
  rts

; A = cell pos: queue its 4 nametable bytes (2 entries)
; addr = $2000 + row*64 + col*2; lo-byte add never carries:
; (pos&$f0)<<2 mod 256 is one of $00/$40/$80/$C0 and col*2 <= 30.
queue_cell:
  sta tmp3              ; pos
  ldy tmp3
  lda (map_ptr),y
  asl a
  asl a
  sta tmp4              ; tile idx * 4
  lda tmp3
  and #$f0
  asl a
  asl a
  sta tmp2              ; low bits of row*64
  lda tmp3
  and #$f0
  lsr a
  lsr a
  lsr a
  lsr a
  lsr a
  lsr a                 ; high bits of row*64
  clc
  adc #$20
  sta tmp1              ; hi
  lda tmp3
  and #$0f
  asl a                 ; col*2
  clc
  adc tmp2
  sta tmp2              ; lo
  ; entry 1: top two tiles
  ldx vbuf_len
  lda tmp1
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #2
  sta vram_buf,x
  inx
  ldy tmp4
  jsr sel_tile_quads    ; ptr0 -> quad table base for current anim_frame
  lda (ptr0),y
  sta vram_buf,x
  inx
  iny
  lda (ptr0),y
  sta vram_buf,x
  inx
  ; entry 2: bottom two tiles (addr + 32, no page cross possible)
  lda tmp1
  sta vram_buf,x
  inx
  lda tmp2
  clc
  adc #32
  sta vram_buf,x
  inx
  lda #2
  sta vram_buf,x
  inx
  iny
  lda (ptr0),y
  sta vram_buf,x
  inx
  iny
  lda (ptr0),y
  sta vram_buf,x
  inx
  stx vbuf_len
  rts

; ============================================================
; logic: tile overlays + events
; ============================================================
; Re-derive overlay state after anything that can change a cond
; (room load, item pickup, event). Cheap: ovl_n is capped at 16.
logic_reeval:
  jsr apply_overlays
  jmp rebuild_anim_list

; For each overlay {pos, cond, tile}: desired tile = cond met ? overlay
; : ROM base. Write differences into map_ram; outside room load, queue
; the cell position for a nametable redraw (drained in st_walk).
; Clobbers tmp0-tmp5, ptr0, ptr1, A, X, Y.
apply_overlays:
  lda ovl_n
  bne @go
  rts
@go:
  ; ptr0 = ROM base map (room_ptr + 32)
  lda room_ptr
  clc
  adc #32
  sta ptr0
  lda room_ptr+1
  adc #0
  sta ptr0+1
  lda #0
  sta tmp0              ; overlay index
  sta tmp1              ; list offset (index*3)
@ovl:
  ldy tmp1
  lda (ovl_ptr),y
  sta tmp2              ; pos
  iny
  lda (ovl_ptr),y
  sta tmp3              ; cond
  iny
  lda (ovl_ptr),y
  sta tmp4              ; overlay tile
  lda tmp3
  jsr cond_met
  bcs @want_ovl
  ldy tmp2
  lda (ptr0),y          ; ROM base tile
  jmp @have
@want_ovl:
  lda tmp4
@have:
  ldy tmp2
  cmp map_ram,y
  beq @next
  sta map_ram,y
  lda in_load
  bne @next             ; full redraw follows during room load
  ldx ovl_pend_n
  cpx #16
  bcs @next
  lda tmp2
  sta ovl_pend,x
  inc ovl_pend_n
@next:
  lda tmp1
  clc
  adc #3
  sta tmp1
  inc tmp0
  lda tmp0
  cmp ovl_n
  bne @ovl
  rts

; scan map_ram for animated tiles -> anim_list / n_anim (cap 32)
rebuild_anim_list:
  lda #0
  sta n_anim
  tay
@scan:
  lda map_ram,y
  tax
  lda tile_flags,x
  and #2
  beq @next
  ldx n_anim
  cpx #32
  bcs @next
  tya                   ; cell index == pos byte (16 cols)
  sta anim_list,x
  inc n_anim
@next:
  iny
  cpy #240
  bne @scan
  lda #<anim_list
  sta anim_ptr
  lda #>anim_list
  sta anim_ptr+1
  rts

; redraw up to 2 changed overlay cells per frame (walk state only, so
; these vram entries never share a frame with dialog writes)
ovl_drain:
  lda ovl_pend_n
  bne @go
  rts
@go:
  lda #2
  sta tmp0
@cell:
  ldx ovl_pend_n
  beq @done
  dex
  lda ovl_pend,x
  stx ovl_pend_n
  jsr queue_cell
  dec tmp0
  bne @cell
@done:
  rts

; find event at target_pos whose once-bit is clear and cond is met.
; C=1: ptr0 -> matching event record. Clobbers tmp0, tmp1, ptr0.
find_event:
  ldx n_events
  bne @go
  clc
  rts
@go:
  lda evt_ptr
  sta ptr0
  lda evt_ptr+1
  sta ptr0+1
@loop:
  ldy #0
  lda (ptr0),y
  cmp target_pos
  bne @next
  ; once-event already fired?
  ldy #2
  lda (ptr0),y          ; evflags
  and #1
  beq @cond
  ldy #3
  lda (ptr0),y          ; once index
  stx tmp1
  jsr get_once_flag
  bne @fired
  ldx tmp1
@cond:
  ldy #1
  lda (ptr0),y          ; cond
  cmp #$ff
  beq @hit
  stx tmp1
  jsr cond_met
  ldx tmp1
  bcs @hit
  jmp @next             ; unmet: inert, keep scanning
@fired:
  ldx tmp1
@next:
  ldy #4
  lda (ptr0),y          ; nact
  sta tmp0
  asl a
  clc
  adc tmp0              ; *3
  clc
  adc #5
  jsr ptr0_add
  dex
  bne @loop
  clc
  rts
@hit:
  sec
  rts

; run event at ptr0: set once-bit, execute actions, re-derive overlays,
; then open the pending dialog (if any) last.
run_event:
  ldy #2
  lda (ptr0),y
  and #1
  beq @noonce
  ldy #3
  lda (ptr0),y
  tax
  jsr set_once_flag
@noonce:
  lda #$ff
  sta evt_pdlg
  ldy #4
  lda (ptr0),y
  sta evt_nact
  lda #5
  jsr ptr0_add          ; ptr0 -> first action
@act:
  lda evt_nact
  bne @doact
  jmp @acts_done
@doact:
  ldy #0
  lda (ptr0),y          ; op
  sta tmp0
  iny
  lda (ptr0),y          ; a1
  tax
  iny
  lda (ptr0),y          ; a2
  sta tmp1
  lda tmp0
  cmp #1
  bne @not1
  lda #1
  sta game_flags,x
  jmp @adv
@not1:
  cmp #2
  bne @not2
  lda #0
  sta game_flags,x
  jmp @adv
@not2:
  cmp #3
  bne @not3
  lda game_flags,x
  eor #1
  sta game_flags,x
  jmp @adv
@not3:
  cmp #4
  bne @not4
  lda tmp1
  sta var_vals,x
  jmp @adv
@not4:
  cmp #5
  bne @not5
  ; addVar, signed delta, clamped to 0..255
  lda tmp1
  bmi @vsub
  clc
  adc var_vals,x
  bcc @vstore
  lda #$ff
  jmp @vstore
@vsub:
  clc
  adc var_vals,x
  bcs @vstore           ; no underflow
  lda #0
@vstore:
  sta var_vals,x
  jmp @adv
@not5:
  cmp #6
  bne @not6
  stx evt_pdlg          ; a1 = dialog index
  jmp @adv
@not6:
  cmp #7
  bne @not7
  lda tmp1              ; a2 = mode 0/1/2
  sta spr_anim_ctl,x
  jmp @adv
@not7:
  cmp #8
  bne @not8
  txa                  ; a1 = sfx index
  jsr sfx_play
  jmp @adv
@not8:
  cmp #9
  bne @adv
  cpx #$ff             ; a1 = song index, $ff = stop
  beq @song_stop
  txa
  jsr music_init
  jmp @adv
@song_stop:
  jsr music_stop
@adv:
  lda #3
  jsr ptr0_add
  dec evt_nact
  jmp @act
@acts_done:
  jsr logic_reeval
  lda evt_pdlg
  cmp #$ff
  beq @nodlg
  pha
  lda #SFX_TALK
  jsr sfx_play
  pla
  jsr begin_dialog
@nodlg:
  rts

; ptr0 = tile_quads_f0 or _f1 depending on anim_frame
sel_tile_quads:
  lda anim_frame
  bne @f1
  lda #<tile_quads_f0
  sta ptr0
  lda #>tile_quads_f0
  sta ptr0+1
  rts
@f1:
  lda #<tile_quads_f1
  sta ptr0
  lda #>tile_quads_f1
  sta ptr0+1
  rts

; ============================================================
; nametable row rendering
; ============================================================
; A = nt row (0..29) -> tmp1/tmp2 = PPU addr hi/lo
nt_row_addr:
  sta tmp3
  and #%00000111
  asl a
  asl a
  asl a
  asl a
  asl a
  sta tmp2
  lda tmp3
  lsr a
  lsr a
  lsr a
  clc
  adc #$20
  sta tmp1
  rts

; A = nt row (0..29): build 32 tile bytes into row_buf from room map
draw_nt_row:
  sta tmp3
  lsr a                 ; cell row
  asl a
  asl a
  asl a
  asl a
  sta tmp4              ; (row>>1)*16 = pos of first cell in the row
  lda tmp3
  and #1
  asl a                 ; half*2: 0 = top pair, 2 = bottom pair
  sta tmp5
  jsr sel_tile_quads    ; ptr0 -> quad table for current anim_frame
  ldx #0                ; output col 0..31
@col:
  txa
  lsr a                 ; cell col
  clc
  adc tmp4
  tay
  lda (map_ptr),y
  asl a
  asl a
  clc
  adc tmp5              ; tile*4 + half*2
  tay
  lda (ptr0),y
  sta row_buf,x
  inx
  iny
  lda (ptr0),y
  sta row_buf,x
  inx
  cpx #32
  bne @col
  rts

; ============================================================
; room transitions (rendering stays on; writes go via vram_buf)
; ============================================================
hide_sprites:
  lda #$ff
  ldx #0
@h:
  sta oam_shadow,x
  inx
  bne @h
  rts

; A = nt col (0..31): build 30 tile bytes into row_buf from room map
draw_nt_col:
  sta tmp3
  lsr a
  sta tmp4              ; cell col
  lda tmp3
  and #1
  sta tmp5              ; col half: quad +1 when right
  jsr sel_tile_quads    ; ptr0 -> quad table
  ldx #0                ; nt row 0..29
@row:
  txa
  and #1
  asl a
  clc
  adc tmp5
  sta tmp0              ; (row&1)*2 + (col&1)
  txa
  lsr a                 ; cell row
  asl a
  asl a
  asl a
  asl a
  clc
  adc tmp4
  tay
  lda (map_ptr),y
  asl a
  asl a
  clc
  adc tmp0              ; tile*4 + quad
  tay
  lda (ptr0),y
  sta row_buf,x
  inx
  cpx #30
  bne @row
  rts

; tmp2 = nt col: buffer a +32-mode column write of the dest room,
; plus its attribute column once all 4 nt cols of the block are in.
buf_dest_col:
  lda tmp2
  jsr draw_nt_col
  ldx vbuf_len
  lda #$a0              ; $20 | $80 column mode
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #30
  sta vram_buf,x
  inx
  ldy #0
@c:
  lda row_buf,y
  sta vram_buf,x
  inx
  iny
  cpy #30
  bne @c
  stx vbuf_len
  lda tmp2
  and #3
  cmp #3
  bne @nodattr
  ; attr col tmp2>>2: 8 bytes stride 8 from dest attrs (room_ptr+272)
  lda tmp2
  lsr a
  lsr a
  sta tmp3
  lda room_ptr
  clc
  adc #<272
  sta ptr1
  lda room_ptr+1
  adc #>272
  sta ptr1+1
  ldx vbuf_len
  ldy #0                ; attr row
@a:
  tya
  asl a
  asl a
  asl a
  clc
  adc tmp3              ; row*8 + col
  sta tmp4
  lda #$23
  sta vram_buf,x
  inx
  lda tmp4
  clc
  adc #$c0
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  sty tmp5
  ldy tmp4
  lda (ptr1),y
  sta vram_buf,x
  inx
  ldy tmp5
  iny
  cpy #8
  bne @a
  stx vbuf_len
@nodattr:
  rts

; A = nt row: buffer a dest-room row into the lower nametable ($2800),
; plus that block's attr row ($2BC0) when it completes.
buf_dest_row_nt2:
  pha
  jsr draw_nt_row       ; row_buf from dest map
  pla
  pha
  jsr nt_row_addr       ; tmp1 hi ($20..), tmp2 lo
  ldx vbuf_len
  lda tmp1
  clc
  adc #$08              ; $2800
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #32
  sta vram_buf,x
  inx
  ldy #0
@r:
  lda row_buf,y
  sta vram_buf,x
  inx
  iny
  cpy #32
  bne @r
  stx vbuf_len
  pla
  sta tmp3              ; nt row
  and #3
  cmp #3
  beq @attr
  lda tmp3
  cmp #29               ; last row closes attr row 7
  bne @noattr
@attr:
  lda tmp3
  lsr a
  lsr a
  cmp #8
  bcc @arow
  lda #7
@arow:
  sta tmp4              ; attr row 0..7
  lda room_ptr
  clc
  adc #<272
  sta ptr1
  lda room_ptr+1
  adc #>272
  sta ptr1+1
  ldx vbuf_len
  lda #$2b
  sta vram_buf,x
  inx
  lda tmp4
  asl a
  asl a
  asl a
  clc
  adc #$c0
  sta vram_buf,x
  inx
  lda #8
  sta vram_buf,x
  inx
  lda tmp4
  asl a
  asl a
  asl a
  tay
  lda #0
  sta tmp5
@ab:
  lda (ptr1),y
  sta vram_buf,x
  inx
  iny
  inc tmp5
  lda tmp5
  cmp #8
  bne @ab
  stx vbuf_len
@noattr:
  rts

; buffer the dest room's 32 palette bytes ($3F00) via vram_buf, so the
; incoming room scrolls in with its own configured palette
buf_dest_palette:
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$00
  sta vram_buf,x
  inx
  lda #32
  sta vram_buf,x
  inx
  ldy #0
@p:
  lda (room_ptr),y
  sta vram_buf,x
  inx
  iny
  cpy #32
  bne @p
  stx vbuf_len
  rts

; Zelda-style scroll to trans_room in trans_dir. On return the visible
; frame is the dest room; caller does load_room (rendering off).
trans_scroll:
  lda trans_room
  jsr room_ptr_set      ; draw from dest data
  jsr buf_dest_palette  ; dest palette applies as the scroll starts
  jsr wait_frame
  lda trans_dir
  cmp #2
  bcs trans_scroll_v
; --- horizontal: replace the just-wrapped column each vblank ---
trans_scroll_h:
  lda #0
  sta trans_step
@step:
  inc trans_step
  lda trans_dir
  bne @w
  lda trans_step        ; E: col = step-1
  sec
  sbc #1
  jmp @have
@w:
  lda #32               ; W: col = 32-step
  sec
  sbc trans_step
@have:
  sta tmp2
  jsr buf_dest_col
  lda trans_step
  asl a
  asl a
  asl a                 ; x = 8*step (mod 256)
  ldy trans_dir
  beq @sx
  eor #$ff              ; W: x = -8*step
  clc
  adc #1
@sx:
  sta scroll_x
  jsr wait_frame
  lda trans_step
  cmp #32
  bne @step
  lda #0
  sta scroll_x
  rts
; --- vertical: pre-draw dest into $2800, then scroll through it ---
trans_scroll_v:
  lda #0
  sta trans_step
@prep:
  lda trans_step
  jsr buf_dest_row_nt2
  jsr wait_frame
  inc trans_step
  lda trans_step
  cmp #30
  bne @prep
  lda #0
  sta trans_step
@sstep:
  inc trans_step
  lda trans_step
  asl a
  asl a
  asl a
  sta tmp2              ; 8*step (8..240)
  lda trans_dir
  cmp #3
  beq @south
  ; N: base $2800, y = 240-8*step (232..0)
  lda ppuctrl_sh
  ora #$02
  sta ppuctrl_sh
  lda #240
  sec
  sbc tmp2
  sta scroll_y
  jmp @swait
@south:
  ; S: base $2000, y = 8*step; final step lands on $2800 y=0
  lda tmp2
  cmp #240
  bcc @sy
  lda ppuctrl_sh
  ora #$02
  sta ppuctrl_sh
  lda #0
@sy:
  sta scroll_y
@swait:
  jsr wait_frame
  lda trans_step
  cmp #30
  bne @sstep
  ; freeze: hand the PPU to load_room with rendering off, base back to $2000
  lda #1
  sta in_load
  lda #0
  sta PPUMASK
  sta scroll_y
  lda ppuctrl_sh
  and #$fd
  sta ppuctrl_sh
  rts

; backdrop → black so blank tiles read as black blocks
buf_black_backdrop:
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$00
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  lda #$0f
  sta vram_buf,x
  inx
  stx vbuf_len
  rts

; diagonal wipe to black blocks over the current room
trans_wipe:
  jsr buf_black_backdrop
  lda #0
  sta trans_step        ; diagonal d = cx+cy, 0..29
@diag:
  lda #0
  sta tmp2              ; cx
@cell:
  lda trans_step
  sec
  sbc tmp2              ; cy = d-cx
  bmi @flush            ; below the diagonal: done with this d
  cmp #15
  bcs @skip             ; cy > 14: cx still too small
  sta tmp3
  jsr buf_black_cell
  lda vbuf_len
  cmp #64
  bcc @skip
  jsr wait_frame
@skip:
  inc tmp2
  lda tmp2
  cmp #16
  bne @cell
@flush:
  jsr wait_frame
  inc trans_step
  lda trans_step
  cmp #30
  bne @diag
  rts

; tmp2 = cx, tmp3 = cy: buffer the 2×2 blank-tile write for one cell
buf_black_cell:
  lda tmp3
  lsr a
  lsr a
  clc
  adc #$20
  ora #$80              ; column mode: each half is TL/BL then TR/BR
  sta tmp4              ; addr hi
  lda tmp3
  and #3
  asl a
  asl a
  asl a
  asl a
  asl a
  asl a                 ; (cy&3)<<6
  sta tmp5
  lda tmp2
  asl a
  ora tmp5
  sta tmp5              ; addr lo
  ldx vbuf_len
  ldy #0
@half:
  lda tmp4
  sta vram_buf,x
  inx
  tya
  clc
  adc tmp5
  sta vram_buf,x
  inx
  lda #2
  sta vram_buf,x
  inx
  lda #0
  sta vram_buf,x
  inx
  sta vram_buf,x
  inx
  iny
  cpy #2
  bne @half
  stx vbuf_len
  rts

; A = color, darkened by tmp1 brightness rows; $0D/$0E clamp to $0F
darken_color:
  ldy tmp1
  beq @dchk
@dloop:
  sec
  sbc #$10
  bcs @dnext
  lda #$0f
  rts
@dnext:
  dey
  bne @dloop
@dchk:
  cmp #$0d
  beq @dblack
  cmp #$0e
  beq @dblack
  rts
@dblack:
  lda #$0f
  rts

; buffer the room palette at (room_ptr), darkened tmp1 steps
buf_pal_dark:
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$00
  sta vram_buf,x
  inx
  lda #32
  sta vram_buf,x
  inx
  lda #0
  sta tmp2
@pd:
  ldy tmp2
  lda (room_ptr),y
  jsr darken_color
  sta vram_buf,x
  inx
  inc tmp2
  lda tmp2
  cmp #32
  bne @pd
  stx vbuf_len
  rts

FADE_HOLD = 6           ; frames per fade step

fade_hold:
  ldy #FADE_HOLD
@fh:
  tya
  pha
  jsr wait_frame
  pla
  tay
  dey
  bne @fh
  rts

; palette fade to black over the old room (room_ptr = old room)
trans_fade_out:
  lda #1
  sta tmp1
@fo:
  jsr buf_pal_dark
  jsr fade_hold
  inc tmp1
  lda tmp1
  cmp #5
  bne @fo
  rts

; palette fade up on the freshly loaded room (room_ptr = dest room)
trans_fade_in:
  lda #3
  sta tmp1
@fi:
  jsr buf_pal_dark
  jsr fade_hold
  dec tmp1
  bpl @fi
  lda #0
  sta fade_pend
  rts

; tmp2 = cell col (0..15): buffer its two nt columns as blank tiles
buf_black_col:
  ldy #0
@bc2:
  ldx vbuf_len
  lda #$a0              ; $20 | column mode
  sta vram_buf,x
  inx
  tya
  sta tmp3
  lda tmp2
  asl a
  clc
  adc tmp3              ; nt col = cell*2 (+1)
  sta vram_buf,x
  inx
  lda #30
  sta vram_buf,x
  inx
  lda #0
  sty tmp3
  ldy #30
@bz:
  sta vram_buf,x
  inx
  dey
  bne @bz
  ldy tmp3
  stx vbuf_len
  iny
  cpy #2
  bne @bc2
  rts

; A = cell row (0..14): buffer its two nt rows as blank tiles
buf_black_row:
  asl a
  sta tmp4              ; base nt row (nt_row_addr clobbers tmp1/tmp2/tmp3)
  ldy #0
@br2:
  tya
  pha
  tya
  clc
  adc tmp4
  jsr nt_row_addr       ; tmp1 hi, tmp2 lo
  ldx vbuf_len
  lda tmp1
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #32
  sta vram_buf,x
  inx
  lda #0
  ldy #32
@rz:
  sta vram_buf,x
  inx
  dey
  bne @rz
  stx vbuf_len
  pla
  tay
  iny
  cpy #2
  bne @br2
  rts

; curtain: black columns close from both edges to the center
trans_curtain:
  jsr buf_black_backdrop
  lda #0
  sta trans_step        ; left cell col 0..7
@cur:
  lda trans_step
  sta tmp2
  jsr buf_black_col
  jsr wait_frame
  lda #15
  sec
  sbc trans_step
  sta tmp2
  jsr buf_black_col
  jsr wait_frame
  inc trans_step
  lda trans_step
  cmp #8
  bne @cur
  rts

; venetian blinds: rows 0,3,6.. then 1,4,7.. then 2,5,8..
trans_blinds:
  jsr buf_black_backdrop
  lda #0
  sta trans_step        ; phase 0..2
@phase:
  lda trans_step
@brow:
  pha
  jsr buf_black_row
  jsr wait_frame
  pla
  clc
  adc #3
  cmp #15
  bcc @brow
  inc trans_step
  lda trans_step
  cmp #3
  bne @phase
  rts

; A = nt row: queue row_buf as one 32-byte vram entry
queue_row:
  jsr nt_row_addr
  ldx vbuf_len
  lda tmp1
  sta vram_buf,x
  inx
  lda tmp2
  sta vram_buf,x
  inx
  lda #32
  sta vram_buf,x
  inx
  ldy #0
@copy:
  lda row_buf,y
  sta vram_buf,x
  inx
  iny
  cpy #32
  bne @copy
  stx vbuf_len
  rts

; ============================================================
; room loading (rendering off)
; ============================================================
; A = room index
room_ptr_set:
  asl a
  tax
  lda room_table,x
  sta room_ptr
  lda room_table+1,x
  sta room_ptr+1
  ; map_ptr = room_ptr + 32
  lda room_ptr
  clc
  adc #32
  sta map_ptr
  lda room_ptr+1
  adc #0
  sta map_ptr+1
  rts

write_palette:
  lda PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldy #0
@pal:
  lda (room_ptr),y
  sta PPUDATA
  iny
  cpy #32
  bne @pal
  rts

clear_nametable:
  lda PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
  lda #0
  ldx #4
  ldy #0
@clr:
  sta PPUDATA
  iny
  bne @clr
  dex
  bne @clr
  rts

; A = room index. Full load with rendering off.
load_room:
  sta cur_room
  lda #1
  sta in_load
  lda #0
  sta PPUMASK
  lda cur_room
  jsr room_ptr_set
  jsr write_palette

  ; entity lists start at room_ptr + 336
  lda room_ptr
  clc
  adc #<336
  sta ptr0
  lda room_ptr+1
  adc #>336
  sta ptr0+1
  ; exits
  ldy #0
  lda (ptr0),y
  sta n_exits
  jsr ptr0_inc
  lda ptr0
  sta exits_ptr
  lda ptr0+1
  sta exits_ptr+1
  lda n_exits
  asl a
  sta tmp0
  asl a
  clc
  adc tmp0              ; *6 (2n + 4n)
  jsr ptr0_add
  ; endings
  ldy #0
  lda (ptr0),y
  sta n_endings
  jsr ptr0_inc
  lda ptr0
  sta end_ptr
  lda ptr0+1
  sta end_ptr+1
  lda n_endings
  asl a
  asl a                 ; *4
  jsr ptr0_add
  ; sprites {pos, def, appear_cond}
  ldy #0
  lda (ptr0),y
  sta n_sprites
  jsr ptr0_inc
  lda ptr0
  sta spr_ptr
  lda ptr0+1
  sta spr_ptr+1
  lda n_sprites
  asl a
  clc
  adc n_sprites         ; *3
  jsr ptr0_add
  ; items {pos, def, flag, appear_cond}
  ldy #0
  lda (ptr0),y
  sta n_items
  jsr ptr0_inc
  lda ptr0
  sta itm_ptr
  lda ptr0+1
  sta itm_ptr+1
  lda n_items
  asl a
  asl a                 ; *4
  jsr ptr0_add
  ; events {pos, cond, evflags, once_idx, nact, nact*3 bytes} (variable size)
  ldy #0
  lda (ptr0),y
  sta n_events
  jsr ptr0_inc
  lda ptr0
  sta evt_ptr
  lda ptr0+1
  sta evt_ptr+1
  ldx n_events
  beq @evdone
@evskip:
  ldy #4
  lda (ptr0),y          ; nact
  sta tmp0
  asl a
  clc
  adc tmp0              ; *3
  clc
  adc #5
  jsr ptr0_add
  dex
  bne @evskip
@evdone:
  ; overlays {pos, cond, tile}
  ldy #0
  lda (ptr0),y
  sta ovl_n
  jsr ptr0_inc
  lda ptr0
  sta ovl_ptr
  lda ptr0+1
  sta ovl_ptr+1
  lda ovl_n
  asl a
  clc
  adc ovl_n             ; *3
  jsr ptr0_add

  ; trailing song byte: $ff = silence, else start unless already playing
  ldy #0
  lda (ptr0),y
  cmp #$ff
  beq @no_song
  clc
  adc #1                ; compare as song idx + 1
  cmp mus_on
  beq @music_done       ; same song: keep it running seamlessly
  sec
  sbc #1
  jsr music_init
  jmp @music_done
@no_song:
  lda mus_on
  beq @music_done
  jsr music_stop
@music_done:

  ; working tilemap: ROM map -> map_ram, then read everything from RAM
  ldy #0
@mcopy:
  lda (map_ptr),y
  sta map_ram,y
  iny
  cpy #240
  bne @mcopy
  lda #<map_ram
  sta map_ptr
  lda #>map_ram
  sta map_ptr+1
  lda #0
  sta ovl_pend_n        ; rows below repaint everything anyway
  jsr apply_overlays
  jsr rebuild_anim_list
  lda #0
  sta ovl_pend_n

  ; nametable rows 0..29
  lda #0
  sta tmp0              ; current nt row
@rows:
  lda tmp0
  jsr draw_nt_row
  lda tmp0
  jsr nt_row_addr
  lda PPUSTATUS
  lda tmp1
  sta PPUADDR
  lda tmp2
  sta PPUADDR
  ldy #0
@rowcopy:
  lda row_buf,y
  sta PPUDATA
  iny
  cpy #32
  bne @rowcopy
  inc tmp0
  lda tmp0
  cmp #30
  bne @rows

  ; attribute table: 64 bytes at room_ptr + 272
  lda room_ptr
  clc
  adc #<272
  sta ptr0
  lda room_ptr+1
  adc #>272
  sta ptr0+1
  lda PPUSTATUS
  lda #$23
  sta PPUADDR
  lda #$c0
  sta PPUADDR
  ldy #0
@attr:
  lda (ptr0),y
  sta PPUDATA
  iny
  cpy #64
  bne @attr

  lda #$ff
  sta anim_idx
  lda #0
  sta anim_timer
  sta vbuf_len
  lda #$ff
  sta vram_buf
  jsr build_oam
  ; present OAM once manually (NMI path is gated by in_load)
  lda #0
  sta OAMADDR
  lda #>oam_shadow
  sta OAMDMA
  ; a pending fade-in wants the first visible frame black, not full palette
  lda fade_pend
  beq @nofadehold
  lda PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldy #32
  lda #$0f
@fadeblack:
  sta PPUDATA
  dey
  bne @fadeblack
@nofadehold:
  jsr ppu_on
  lda #0
  sta in_load
  rts

ptr0_inc:
  inc ptr0
  bne @ret
  inc ptr0+1
@ret:
  rts

; A = amount to add to ptr0
ptr0_add:
  clc
  adc ptr0
  sta ptr0
  lda ptr0+1
  adc #0
  sta ptr0+1
  rts

; ============================================================
; OAM building: avatar + room sprites + untaken items
; ============================================================
build_oam:
  ; hide everything
  ldx #0
  lda #$fe
@hide:
  sta oam_shadow,x
  inx
  inx
  inx
  inx
  bne @hide

  ; ---- avatar (metasprite 0) ----
  lda #0
  sta oam_off
  sta ms_xor
  ; frame select bit -> tmp0 (0 = f0, 1 = f1)
  lda player_frame
  eor anim_frame
  and #1
  sta tmp0
  lda avatar_attr
  sta ms_attr
  ; pick the quad table for the facing direction
  lda player_dir
  cmp #DIR_UP
  beq @a_up
  cmp #DIR_DOWN
  beq @a_down
  ; --- side (left / right) ---
  ldy tmp0
  bne @side1
  lda #<avatar_quads_f0
  sta quad_ptr
  lda #>avatar_quads_f0
  sta quad_ptr+1
  jmp @a_sflip
@side1:
  lda #<avatar_quads_f1
  sta quad_ptr
  lda #>avatar_quads_f1
  sta quad_ptr+1
@a_sflip:
  ; mirror horizontally when facing left and flip-on-move is enabled
  lda player_dir
  cmp #DIR_LEFT
  bne @adraw
  lda flip_on
  beq @adraw
  lda ms_attr
  ora #$40              ; OAM horizontal flip
  sta ms_attr
  lda #1
  sta ms_xor           ; swap left/right tiles within the metasprite
  jmp @adraw
@a_up:
  ldy tmp0
  bne @up1
  lda #<avatar_up_quads_f0
  sta quad_ptr
  lda #>avatar_up_quads_f0
  sta quad_ptr+1
  jmp @adraw
@up1:
  lda #<avatar_up_quads_f1
  sta quad_ptr
  lda #>avatar_up_quads_f1
  sta quad_ptr+1
  jmp @adraw
@a_down:
  ldy tmp0
  bne @down1
  lda #<avatar_down_quads_f0
  sta quad_ptr
  lda #>avatar_down_quads_f0
  sta quad_ptr+1
  jmp @adraw
@down1:
  lda #<avatar_down_quads_f1
  sta quad_ptr
  lda #>avatar_down_quads_f1
  sta quad_ptr+1
@adraw:
  lda player_x
  asl a
  asl a
  asl a
  asl a
  clc
  adc slide_x           ; smooth tween offset (0 when not sliding / grid mode)
  sta ms_x
  lda player_y
  asl a
  asl a
  asl a
  asl a
  clc
  adc slide_y
  sta ms_y
  jsr draw_metasprite

  ; ---- sprites (entries {pos, def, appear_cond}) ----
  lda #0
  sta ms_xor           ; sprites/items are never flipped
  ldx #0
@sprloop:
  cpx n_sprites
  beq @items
  txa
  pha
  ; oam_off = (1 + x) * 16
  txa
  clc
  adc #1
  asl a
  asl a
  asl a
  asl a
  sta oam_off
  ; y = x*3
  txa
  asl a
  sta tmp1
  txa
  clc
  adc tmp1
  tay
  sty tmp1              ; entry base offset
  iny
  iny
  lda (spr_ptr),y       ; appear cond
  cmp #$ff
  beq @svis
  jsr cond_met          ; clobbers X/Y (X restored from stack at loop end)
  bcc @skipspr
@svis:
  ldy tmp1
  lda (spr_ptr),y       ; pos
  jsr pos_to_msxy
  iny
  lda (spr_ptr),y       ; def index
  asl a
  asl a
  sta tmp0              ; def*4
  lda (spr_ptr),y
  tax
  lda spr_attrs,x
  sta ms_attr
  ; anim control: 0 animate, 1 hold f0, 2 hold f1
  lda spr_anim_ctl,x
  cmp #1
  beq @sf0
  cmp #2
  beq @sf1
  lda anim_frame
  bne @sf1
@sf0:
  lda #<spr_quads_f0
  sta quad_ptr
  lda #>spr_quads_f0
  sta quad_ptr+1
  jmp @squad
@sf1:
  lda #<spr_quads_f1
  sta quad_ptr
  lda #>spr_quads_f1
  sta quad_ptr+1
@squad:
  lda quad_ptr
  clc
  adc tmp0
  sta quad_ptr
  lda quad_ptr+1
  adc #0
  sta quad_ptr+1
  jsr draw_metasprite
@skipspr:
  pla
  tax
  inx
  jmp @sprloop

@items:
  ; ---- items (entries {pos, def, flag, appear_cond}) ----
  ldx #0
@itmloop:
  cpx n_items
  beq @done
  txa
  pha
  ; y = x*4
  txa
  asl a
  asl a
  tay
  sty tmp1              ; entry base offset
  iny
  iny
  lda (itm_ptr),y       ; flag index
  jsr get_item_flag
  bne @skipitem         ; taken
  iny
  lda (itm_ptr),y       ; appear cond
  cmp #$ff
  beq @ivis
  jsr cond_met
  bcc @skipitem
@ivis:
  ldy tmp1
  ; oam_off = (1 + n_sprites + x) * 16
  pla
  pha
  clc
  adc n_sprites
  clc
  adc #1
  asl a
  asl a
  asl a
  asl a
  sta oam_off
  lda (itm_ptr),y       ; pos
  jsr pos_to_msxy
  iny
  lda (itm_ptr),y       ; def index
  asl a
  asl a
  sta tmp0
  lda (itm_ptr),y
  tax
  lda itm_attrs,x
  sta ms_attr
  lda anim_frame
  bne @if1
  lda #<itm_quads_f0
  sta quad_ptr
  lda #>itm_quads_f0
  sta quad_ptr+1
  jmp @iquad
@if1:
  lda #<itm_quads_f1
  sta quad_ptr
  lda #>itm_quads_f1
  sta quad_ptr+1
@iquad:
  lda quad_ptr
  clc
  adc tmp0
  sta quad_ptr
  lda quad_ptr+1
  adc #0
  sta quad_ptr+1
  jsr draw_metasprite
@skipitem:
  pla
  tax
  inx
  jmp @itmloop
@done:
  ; ---- dialog "more/end" arrow: bobbing sprite, last OAM slot ----
  lda game_state
  cmp #ST_DIALOG
  bne @noarrow
  lda dlg_phase
  cmp #DP_PAGE
  beq @arrow
  cmp #DP_END
  bne @noarrow
@arrow:
  ldx #252
  lda frame_ctr
  and #$10              ; toggle every 16 frames
  lsr a
  lsr a
  lsr a                 ; 0 or 2 px bob
  sta tmp3
  lda dlg_base
  asl a
  asl a
  asl a                 ; box top px
  clc
  adc #16               ; OAM y: line 2 (dlg_base+2) - 1
  adc tmp3
  sta oam_shadow,x
  inx
  lda #SPR_TILE_ARROW
  sta oam_shadow,x
  inx
  lda #%00000011        ; spr palette 3 (white while dialog open)
  sta oam_shadow,x
  inx
  lda #240              ; col 30
  sta oam_shadow,x
@noarrow:
  rts

; A = pos byte -> ms_x, ms_y pixels
pos_to_msxy:
  sta tmp2
  and #$0f
  asl a
  asl a
  asl a
  asl a
  sta ms_x
  lda tmp2
  and #$f0
  sta ms_y
  rts

; writes 4 OAM entries at oam_off from quad_ptr (TL TR BL BR)
; during dialog, sprites overlapping the box rows stay hidden
; so the box renders over everything
draw_metasprite:
  lda game_state
  cmp #ST_DIALOG
  bne @visible
  ; hide sprites overlapping the box band (dlg_base*8 .. +31 px);
  ; sprite spans ms_y-1 .. ms_y+14
  lda dlg_base
  asl a
  asl a
  asl a
  sta tmp3              ; box top px
  lda ms_y
  cmp tmp3
  bcc @above
  sbc tmp3              ; carry set by cmp
  cmp #33
  bcs @visible
  rts
@above:
  lda tmp3
  sec
  sbc ms_y
  cmp #15
  bcs @visible
  rts
@visible:
  ; write 4 OAM entries for screen quadrants 0..3 (TL TR BL BR). The source
  ; tile for each quadrant is quad_ptr[quad ^ ms_xor], so ms_xor mirrors the
  ; metasprite (1 = hflip, 2 = vflip, 3 = both) to match the OAM flip bits.
  ldx oam_off
  lda #0
  sta tmp5              ; screen quadrant counter
@msq:
  ; Y: quadrants 0,1 top row (ms_y-1); 2,3 bottom row (ms_y+7)
  lda tmp5
  and #%00000010
  beq @mstop
  lda ms_y
  clc
  adc #7
  jmp @msyw
@mstop:
  lda ms_y
  sec
  sbc #1
@msyw:
  sta oam_shadow,x
  inx
  ; tile = quad_ptr[quad ^ ms_xor]
  lda tmp5
  eor ms_xor
  tay
  lda (quad_ptr),y
  sta oam_shadow,x
  inx
  lda ms_attr
  sta oam_shadow,x
  inx
  ; X: quadrants 0,2 left (ms_x); 1,3 right (ms_x+8)
  lda tmp5
  and #%00000001
  beq @msxl
  lda ms_x
  clc
  adc #8
  jmp @msxw
@msxl:
  lda ms_x
@msxw:
  sta oam_shadow,x
  inx
  inc tmp5
  lda tmp5
  cmp #4
  bne @msq
  rts

; ============================================================
; STATE: ending — black screen, "THE END" blinking mid-screen
; ============================================================
; Entered from dlg_erase once the ending dialog closes. Takes the PPU
; with rendering off (same in_load gate as load_room).
begin_ending:
  lda #1
  sta in_load
  lda #0
  sta PPUMASK
  jsr music_stop
  jsr clear_nametable   ; also zeroes attrs -> BG subpal 0 everywhere
  ; palette: all black, then subpal 0 color 3 (text ink) white
  lda PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldy #32
  lda #PAL_BLACK
@blk:
  sta PPUDATA
  dey
  bne @blk
  lda PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #$03
  sta PPUADDR
  lda #PAL_WHITE
  sta PPUDATA
  ; no sprites on the ending screen
  jsr hide_sprites
  lda #0
  sta OAMADDR
  lda #>oam_shadow
  sta OAMDMA
  ; "THE END" centered by the compiler on nt row 14 ($21C0+col)
  lda PPUSTATUS
  lda #$21
  sta PPUADDR
  lda end_text
  sta PPUADDR
  ldx end_text+1        ; len
  ldy #2
@e:
  lda end_text,y
  sta PPUDATA
  iny
  dex
  bne @e
  lda #0
  sta vbuf_len
  sta scroll_x
  sta scroll_y
  lda #$ff
  sta vram_buf
  lda #ST_ENDING
  sta game_state
  jsr ppu_on
  lda #0
  sta in_load
  rts

; blink: toggle the text ink ($3F03) white/black every 32 frames
st_ending:
  lda frame_ctr
  and #31
  bne @ret
  ldx vbuf_len
  lda #$3f
  sta vram_buf,x
  inx
  lda #$03
  sta vram_buf,x
  inx
  lda #1
  sta vram_buf,x
  inx
  lda frame_ctr
  and #32
  beq @off
  lda #PAL_WHITE
  jmp @wr
@off:
  lda #PAL_BLACK
@wr:
  sta vram_buf,x
  inx
  stx vbuf_len
@ret:
  rts

; ============================================================
; title screen (rendering off at boot)
; ============================================================
draw_title:
  ; game title, centered by compiler (title_text: col, len, tiles...)
  lda PPUSTATUS
  lda #$21
  sta PPUADDR
  lda title_text        ; low addr byte precomputed: $2000+13*32+col -> row 13
  sta PPUADDR
  ldx title_text+1      ; len
  ldy #2
@t:
  lda title_text,y
  sta PPUDATA
  iny
  dex
  bne @t
  ; PRESS START at row 16
  lda PPUSTATUS
  lda #$22
  sta PPUADDR
  lda press_text
  sta PPUADDR
  ldx press_text+1
  ldy #2
@p:
  lda press_text,y
  sta PPUDATA
  iny
  dex
  bne @p
  rts

; ============================================================
; game data tables are appended below by the compiler:
;   start_room, start_pos, text_chars, text_delay,
;   title_text, press_text, end_text,
;   has_splash, splash_pal, splash_nt, splash_attr,
;   tile_flags, tile_quads_f0/f1,
;   avatar_quads_f0/f1, avatar_attr,
;   spr_quads_f0/f1, spr_attrs, spr_dlgs,
;   itm_quads_f0/f1, itm_attrs, itm_dlgs,
;   dlg_lo/dlg_hi + streams, room_table + room records,
;   cond_table (3-byte {op, idx, value} records), var_init
;   (exit entries are 6 bytes: pos, dest_room, dest_pos, req, locked_dlg, trans;
;    sprite entries 3: pos, def, appear_cond; item entries 4: pos, def, flag,
;    appear_cond; then events and overlays — see load_room)
; ============================================================

; ==== game data (generated) ====

start_room:
  .byte $00

start_pos:
  .byte $77

move_smooth:
  .byte $01

move_step:
  .byte $02

move_cont:
  .byte $00

text_chars:
  .byte $01

text_delay:
  .byte $02

tw_sfx:
  .byte $01

; "NOSTROMO"
title_text:
  .byte $ac,$08,$12,$13,$14,$15,$16,$13,$17,$13

; "PRESS START"
press_text:
  .byte $0a,$0b,$18,$16,$19,$14,$14,$10,$14,$15,$1a,$16,$15

; "THE END"
end_text:
  .byte $cc,$07,$15,$1b,$19,$10,$19,$12,$1c

has_splash:
  .byte $00

splash_song:
  .byte $ff

splash_pal:
splash_nt:
splash_attr:
  .byte $00

; 16 tiles: bit0 wall, bit1 animated
tile_flags:
  .byte $00,$01,$00,$00,$01,$03,$01,$01,$01,$01,$00,$01,$03,$01,$00,$01

; CHR quads per tile, frame 0: TL TR BL BR
tile_quads_f0:
  .byte $00,$00,$00,$00
  .byte $a6,$a6,$a6,$a6
  .byte $a7,$a7,$a7,$a7
  .byte $a8,$a9,$aa,$ab
  .byte $ac,$ad,$ae,$af
  .byte $b0,$b1,$b2,$b3
  .byte $b8,$b9,$ba,$bb
  .byte $bc,$bd,$be,$bf
  .byte $c0,$c1,$c2,$c3
  .byte $c4,$c4,$c4,$c4
  .byte $c5,$c5,$c5,$c5
  .byte $c6,$c7,$c8,$c9
  .byte $ca,$cb,$cc,$cd
  .byte $d2,$d3,$d4,$d5
  .byte $d6,$d7,$d8,$d9
  .byte $da,$db,$dc,$dd

; frame 1 (same as f0 when static)
tile_quads_f1:
  .byte $00,$00,$00,$00
  .byte $a6,$a6,$a6,$a6
  .byte $a7,$a7,$a7,$a7
  .byte $a8,$a9,$aa,$ab
  .byte $ac,$ad,$ae,$af
  .byte $b4,$b5,$b6,$b7
  .byte $b8,$b9,$ba,$bb
  .byte $bc,$bd,$be,$bf
  .byte $c0,$c1,$c2,$c3
  .byte $c4,$c4,$c4,$c4
  .byte $c5,$c5,$c5,$c5
  .byte $c6,$c7,$c8,$c9
  .byte $ce,$cf,$d0,$d1
  .byte $d2,$d3,$d4,$d5
  .byte $d6,$d7,$d8,$d9
  .byte $da,$db,$dc,$dd

avatar_quads_f0:
  .byte $01,$02,$03,$04

avatar_quads_f1:
  .byte $01,$02,$05,$06

avatar_attr:
  .byte $00

avatar_up_quads_f0:
  .byte $01,$02,$03,$04

avatar_up_quads_f1:
  .byte $01,$02,$05,$06

avatar_down_quads_f0:
  .byte $01,$02,$03,$04

avatar_down_quads_f1:
  .byte $01,$02,$05,$06

avatar_flip:
  .byte $01

spr_quads_f0:
  .byte $07,$08,$09,$0a
  .byte $0b,$0c,$0d,$0e
  .byte $13,$14,$15,$16

spr_quads_f1:
  .byte $07,$08,$09,$0a
  .byte $0f,$10,$11,$12
  .byte $17,$18,$19,$1a

spr_attrs:
  .byte $03,$01,$02

spr_dlgs:
  .byte $01,$07,$0d

; cond pool index; $ff none
spr_conds:
  .byte $ff,$00,$ff

spr_alt_dlgs:
  .byte $ff,$08,$ff

itm_quads_f0:
  .byte $1b,$1c,$1d,$1e
  .byte $1f,$20,$21,$22

itm_quads_f1:
  .byte $1b,$1c,$1d,$1e
  .byte $1f,$20,$21,$22

itm_attrs:
  .byte $01,$00

itm_dlgs:
  .byte $02,$0b

; cond pool index; $ff none
itm_conds:
  .byte $ff,$ff

itm_alt_dlgs:
  .byte $ff,$ff

wave_first:
  .byte $84

wave_end:
  .byte $a6

dlg_lo:
  .byte <dlg_0,<dlg_1,<dlg_2,<dlg_3,<dlg_4,<dlg_5,<dlg_6,<dlg_7,<dlg_8,<dlg_9,<dlg_10,<dlg_11,<dlg_12,<dlg_13,<dlg_14,<dlg_15,<dlg_16,<dlg_17,<dlg_18

dlg_hi:
  .byte >dlg_0,>dlg_1,>dlg_2,>dlg_3,>dlg_4,>dlg_5,>dlg_6,>dlg_7,>dlg_8,>dlg_9,>dlg_10,>dlg_11,>dlg_12,>dlg_13,>dlg_14,>dlg_15,>dlg_16,>dlg_17,>dlg_18

; DLG wake
dlg_0:
  .byte $03,$17,$1d,$1e,$15,$1b,$1e,$1d,$16,$1f,$10,$34,$35,$35,$36,$10
  .byte $37,$35,$38,$39,$3a,$39,$34,$3b,$01,$3c,$3d,$3e,$3c,$3f,$3c,$10
  .byte $3d,$40,$41,$42,$3f,$43,$3e,$3d,$40,$44,$45,$10,$46,$43,$40,$10
  .byte $47,$41,$40,$48,$02,$17,$19,$17,$25,$19,$16,$10,$16,$19,$26,$21
  .byte $26,$19,$1c,$22,$10,$15,$1b,$19,$01,$46,$3d,$49,$40,$41,$3c,$45
  .byte $45,$45,$10,$3e,$41,$40,$10,$43,$46,$3d,$10,$3f,$43,$10,$3d,$49
  .byte $40,$3f,$41,$02,$18,$13,$1c,$14,$22,$10,$15,$1b,$19,$16,$19,$10
  .byte $21,$14,$10,$12,$13,$01,$40,$4a,$4b,$4c,$3e,$43,$3e,$3d,$3f,$46
  .byte $43,$10,$46,$43,$10,$4d,$3f,$4c,$40,$45,$10,$4b,$4c,$40,$3e,$3c
  .byte $40,$02,$18,$16,$13,$23,$19,$19,$1c,$10,$15,$13,$10,$2a,$13,$1d
  .byte $16,$10,$1c,$1d,$15,$21,$19,$14,$22,$00

; DLG kane
dlg_1:
  .byte $2b,$1a,$12,$19,$10,$12,$19,$26,$19,$16,$10,$24,$13,$2b,$19,$22
  .byte $10,$29,$16,$13,$14,$15,$10,$1b,$1a,$14,$01,$3c,$40,$3e,$4c,$40
  .byte $44,$10,$49,$3f,$3c,$10,$40,$4e,$40,$3c,$10,$49,$3e,$4c,$4d,$4f
  .byte $46,$4b,$40,$43,$45,$02,$24,$1b,$1a,$15,$19,$26,$19,$16,$10,$15
  .byte $13,$16,$19,$10,$15,$1b,$16,$13,$1d,$20,$1b,$10,$15,$1b,$21,$14
  .byte $01,$3c,$49,$3f,$4b,$45,$10,$3f,$3d,$10,$3c,$3d,$3e,$41,$3d,$40
  .byte $44,$10,$48,$3f,$3d,$49,$10,$49,$3f,$42,$45,$02,$2a,$13,$1d,$10
  .byte $1a,$16,$19,$10,$1a,$28,$13,$12,$19,$10,$24,$21,$15,$1b,$10,$15
  .byte $1b,$19,$01,$3c,$4c,$40,$40,$4b,$40,$41,$3c,$10,$43,$46,$48,$45
  .byte $00

; DLG pcard
dlg_2:
  .byte $2a,$13,$1d,$16,$10,$1a,$23,$23,$19,$14,$14,$10,$23,$1a,$16,$1c
  .byte $22,$10,$1a,$10,$1c,$19,$1a,$1c,$01,$48,$46,$42,$3e,$43,$50,$3c
  .byte $10,$3d,$49,$51,$42,$52,$4b,$41,$3f,$43,$3d,$10,$3f,$3c,$10,$3c
  .byte $3d,$3f,$4c,$4c,$02,$13,$12,$10,$21,$15,$22,$10,$21,$15,$10,$24
  .byte $21,$28,$28,$10,$13,$18,$19,$12,$10,$15,$1b,$19,$10,$24,$1a,$2a
  .byte $14,$01,$3d,$49,$40,$10,$3c,$49,$3f,$4b,$10,$44,$40,$47,$3f,$44
  .byte $40,$3c,$10,$4e,$46,$51,$10,$3e,$41,$40,$02,$1a,$28,$28,$13,$24
  .byte $19,$1c,$10,$15,$13,$10,$24,$1a,$28,$2b,$22,$00

; DLG brkA
dlg_3:
  .byte $04,$25,$16,$19,$1a,$2b,$19,$16,$10,$1a,$10,$20,$16,$13,$1a,$12
  .byte $14,$10,$13,$26,$19,$16,$22,$01,$3c,$46,$42,$40,$48,$49,$40,$41
  .byte $40,$10,$44,$40,$40,$4b,$10,$3f,$43,$10,$3d,$49,$40,$10,$49,$51
  .byte $4c,$4c,$45,$02,$1a,$10,$29,$1a,$12,$10,$14,$1b,$1d,$1c,$1c,$19
  .byte $16,$14,$10,$25,$1a,$23,$2b,$10,$15,$13,$10,$28,$21,$29,$19,$22
  .byte $01,$53,$54,$55,$10,$53,$56,$10,$57,$58,$53,$59,$00

; DLG brkB
dlg_4:
  .byte $04,$25,$16,$19,$1a,$2b,$19,$16,$10,$25,$10,$25,$21,$15,$19,$14
  .byte $10,$14,$1b,$1d,$15,$22,$10,$20,$16,$19,$19,$12,$01,$4c,$3f,$5a
  .byte $49,$3d,$10,$47,$41,$3e,$48,$4c,$3c,$10,$44,$46,$48,$43,$10,$3d
  .byte $49,$40,$02,$23,$13,$16,$16,$21,$1c,$13,$16,$10,$28,$21,$2b,$19
  .byte $10,$14,$13,$17,$19,$15,$1b,$21,$12,$20,$01,$48,$3e,$5b,$3f,$43
  .byte $5a,$45,$10,$57,$58,$53,$10,$53,$56,$10,$57,$58,$53,$59,$00

; DLG power
dlg_5:
  .byte $17,$1a,$21,$12,$10,$18,$13,$24,$19,$16,$10,$14,$21,$20,$1b,$14
  .byte $10,$25,$1a,$23,$2b,$10,$13,$12,$22,$01,$3d,$49,$40,$10,$3c,$40
  .byte $3e,$4c,$40,$44,$10,$44,$46,$46,$41,$3c,$10,$51,$43,$47,$4c,$40
  .byte $43,$47,$49,$45,$02,$13,$12,$19,$10,$25,$2a,$10,$13,$12,$19,$22
  .byte $10,$15,$1b,$19,$10,$14,$1b,$21,$18,$10,$21,$14,$01,$4c,$3f,$3c
  .byte $3d,$40,$43,$3f,$43,$5a,$10,$3e,$5a,$3e,$3f,$43,$45,$10,$3c,$46
  .byte $10,$3f,$3c,$02,$24,$1b,$1a,$15,$19,$26,$19,$16,$10,$19,$28,$14
  .byte $19,$10,$21,$14,$10,$1a,$25,$13,$1a,$16,$1c,$22,$00

; DLG alone
dlg_6:
  .byte $15,$1b,$19,$10,$23,$13,$16,$16,$21,$1c,$13,$16,$10,$14,$15,$16
  .byte $19,$15,$23,$1b,$19,$14,$10,$19,$17,$18,$15,$2a,$01,$3f,$43,$10
  .byte $52,$46,$3d,$49,$10,$44,$3f,$41,$40,$47,$3d,$3f,$46,$43,$3c,$45
  .byte $10,$4e,$46,$51,$10,$47,$3e,$43,$02,$1b,$19,$1a,$16,$10,$2a,$13
  .byte $1d,$16,$10,$13,$24,$12,$10,$25,$28,$13,$13,$1c,$22,$10,$14,$19
  .byte $26,$19,$12,$01,$43,$3e,$42,$40,$3c,$10,$46,$43,$10,$3d,$49,$40
  .byte $10,$41,$46,$3c,$3d,$40,$41,$45,$10,$3c,$3f,$4a,$02,$18,$13,$1c
  .byte $14,$2c,$10,$23,$13,$28,$1c,$22,$10,$1a,$12,$1c,$10,$2a,$13,$1d
  .byte $22,$00

; DLG moth0
dlg_7:
  .byte $03,$17,$1d,$1e,$15,$1b,$1e,$1d,$16,$1f,$10,$3a,$10,$5c,$5d,$39
  .byte $39,$35,$5e,$10,$36,$3a,$5f,$5c,$60,$5f,$5f,$01,$61,$62,$55,$58
  .byte $10,$63,$64,$65,$66,$53,$65,$64,$57,$64,$53,$54,$59,$10,$65,$66
  .byte $55,$61,$64,$67,$68,$02,$36,$3a,$38,$69,$5c,$5e,$3a,$6a,$69,$5f
  .byte $10,$5d,$38,$69,$10,$5f,$69,$5d,$6b,$69,$36,$10,$5e,$35,$01,$65
  .byte $61,$64,$55,$54,$61,$55,$10,$63,$64,$6c,$64,$65,$64,$53,$54,$10
  .byte $61,$68,$55,$67,$62,$67,$54,$61,$55,$59,$02,$38,$69,$5e,$60,$38
  .byte $39,$10,$5e,$35,$10,$6d,$35,$60,$38,$10,$5f,$5e,$5d,$5e,$3a,$35
  .byte $39,$3b,$10,$15,$1b,$19,$01,$3e,$42,$52,$40,$41,$10,$4c,$3f,$5a
  .byte $49,$3d,$10,$44,$46,$40,$3c,$10,$43,$46,$3d,$10,$52,$4c,$3f,$43
  .byte $5b,$45,$02,$21,$15,$10,$12,$19,$26,$19,$16,$10,$25,$28,$21,$12
  .byte $2b,$14,$22,$00

; DLG moth1
dlg_8:
  .byte $03,$17,$1d,$1e,$15,$1b,$1e,$1d,$16,$1f,$10,$5c,$6b,$69,$5d,$38
  .byte $5d,$39,$5c,$69,$01,$62,$55,$61,$53,$6e,$54,$64,$65,$55,$63,$59
  .byte $10,$65,$61,$64,$55,$54,$61,$55,$10,$53,$6c,$55,$62,$62,$64,$63
  .byte $55,$02,$5d,$5c,$5e,$3a,$6a,$69,$3b,$10,$6d,$35,$60,$10,$6f,$5d
  .byte $6a,$69,$10,$38,$69,$5d,$36,$10,$70,$6f,$5d,$5e,$01,$67,$65,$71
  .byte $10,$62,$55,$67,$63,$59,$10,$57,$71,$55,$54,$10,$72,$53,$73,$10
  .byte $67,$68,$62,$55,$67,$63,$72,$02,$60,$39,$36,$69,$38,$5f,$5e,$5d
  .byte $39,$36,$10,$70,$6f,$5d,$5e,$10,$6d,$35,$60,$10,$5d,$38,$69,$10
  .byte $5e,$35,$01,$74,$55,$59,$00

; DLG o937
dlg_9:
  .byte $04,$14,$18,$19,$23,$21,$1a,$28,$10,$13,$16,$1c,$19,$16,$10,$2d
  .byte $2e,$2f,$10,$11,$10,$5c,$38,$69,$70,$01,$55,$75,$66,$55,$54,$63
  .byte $67,$76,$68,$55,$59,$10,$4b,$41,$3f,$46,$41,$3f,$3d,$4e,$10,$46
  .byte $43,$40,$77,$02,$19,$12,$14,$1d,$16,$19,$10,$16,$19,$15,$1d,$16
  .byte $12,$10,$13,$29,$10,$13,$16,$20,$1a,$12,$21,$14,$17,$01,$4d,$46
  .byte $41,$10,$48,$40,$3e,$4b,$46,$43,$3c,$10,$44,$3f,$78,$3f,$3c,$3f
  .byte $46,$43,$45,$10,$3e,$4c,$4c,$02,$13,$15,$1b,$19,$16,$10,$23,$13
  .byte $12,$14,$21,$1c,$19,$16,$1a,$15,$21,$13,$12,$14,$01,$3c,$40,$47
  .byte $46,$43,$44,$3e,$41,$4e,$45,$10,$4e,$46,$51,$10,$48,$40,$41,$40
  .byte $10,$43,$40,$78,$40,$41,$02,$17,$19,$1a,$12,$15,$10,$15,$13,$10
  .byte $24,$1a,$2b,$19,$22,$10,$2a,$13,$1d,$10,$24,$19,$16,$19,$01,$42
  .byte $40,$3e,$43,$3d,$10,$3d,$46,$10,$3e,$41,$41,$3f,$78,$40,$10,$3e
  .byte $3c,$10,$47,$3e,$41,$5a,$46,$45,$00

; DLG log
dlg_10:
  .byte $14,$23,$21,$19,$12,$23,$19,$10,$13,$29,$29,$21,$23,$19,$16,$2c
  .byte $10,$18,$19,$16,$14,$13,$12,$1a,$28,$01,$4c,$46,$5a,$77,$10,$85
  .byte $10,$87,$89,$8b,$85,$8d,$8f,$10,$85,$91,$93,$10,$95,$97,$8d,$85
  .byte $91,$99,$9b,$10,$3e,$02,$14,$1d,$16,$26,$21,$26,$13,$16,$2c,$10
  .byte $1d,$12,$23,$28,$13,$1d,$1c,$19,$1c,$10,$25,$2a,$01,$47,$46,$43
  .byte $3c,$47,$3f,$40,$43,$47,$40,$45,$10,$41,$40,$42,$46,$41,$3c,$40
  .byte $45,$10,$46,$41,$02,$1c,$19,$28,$1d,$14,$21,$13,$12,$14,$10,$13
  .byte $29,$10,$17,$13,$16,$1a,$28,$21,$15,$2a,$22,$01,$46,$78,$40,$41
  .byte $41,$3f,$44,$40,$10,$47,$46,$44,$40,$77,$10,$79,$7a,$7b,$45,$10
  .byte $3d,$49,$40,$02,$23,$13,$17,$18,$1a,$12,$2a,$10,$1a,$28,$16,$19
  .byte $1a,$1c,$2a,$10,$2b,$12,$19,$24,$22,$10,$24,$19,$10,$1a,$16,$19
  .byte $01,$3e,$4c,$4c,$10,$40,$4a,$4b,$40,$43,$44,$3e,$52,$4c,$40,$45
  .byte $10,$40,$78,$40,$43,$10,$42,$40,$45,$02,$19,$26,$19,$12,$10,$2a
  .byte $13,$1d,$22,$00

; DLG pcool
dlg_11:
  .byte $1a,$10,$23,$13,$13,$28,$1a,$12,$15,$10,$23,$19,$28,$28,$2c,$01
  .byte $3c,$5b,$3f,$43,$4f,$4d,$41,$46,$3c,$3d,$3f,$43,$5a,$10,$47,$46
  .byte $4c,$44,$45,$10,$49,$40,$3e,$78,$4e,$02,$19,$12,$13,$1d,$20,$1b
  .byte $10,$15,$13,$10,$23,$1b,$1a,$16,$20,$19,$10,$15,$1b,$19,$10,$1a
  .byte $21,$16,$28,$13,$23,$2b,$01,$4b,$51,$41,$5a,$40,$10,$50,$10,$3f
  .byte $4d,$10,$4e,$46,$51,$10,$47,$3e,$43,$10,$41,$40,$3e,$47,$49,$10
  .byte $3f,$3d,$45,$00

; DLG drop
dlg_12:
  .byte $25,$19,$1b,$21,$12,$1c,$10,$2a,$13,$1d,$10,$15,$1b,$19,$10,$26
  .byte $19,$12,$15,$10,$20,$16,$21,$28,$28,$19,$01,$4b,$40,$40,$4c,$3c
  .byte $10,$46,$4b,$40,$43,$10,$48,$3f,$3d,$49,$46,$51,$3d,$10,$3e,$10
  .byte $3c,$46,$51,$43,$44,$45,$02,$14,$13,$17,$19,$15,$1b,$21,$12,$20
  .byte $10,$24,$19,$15,$10,$1d,$12,$29,$13,$28,$1c,$14,$10,$21,$12,$15
  .byte $13,$01,$3d,$49,$40,$10,$44,$3e,$41,$5b,$10,$3e,$43,$44,$10,$3f
  .byte $3c,$10,$5a,$46,$43,$40,$10,$52,$40,$4d,$46,$41,$40,$02,$2a,$13
  .byte $1d,$10,$15,$1d,$16,$12,$22,$10,$84,$90,$10,$9c,$9e,$a0,$a2,$92
  .byte $10,$98,$a0,$96,$10,$86,$8c,$8e,$01,$a5,$8f,$8d,$8f,$10,$9f,$a1
  .byte $a3,$9b,$00

; DLG xeno
dlg_13:
  .byte $21,$15,$10,$1b,$1a,$12,$20,$14,$10,$21,$12,$10,$15,$1b,$19,$10
  .byte $18,$21,$18,$19,$24,$13,$16,$2b,$2c,$01,$42,$46,$41,$40,$10,$42
  .byte $3e,$47,$49,$3f,$43,$40,$10,$3d,$49,$3e,$43,$10,$3e,$43,$3f,$42
  .byte $3e,$4c,$45,$02,$25,$16,$19,$1a,$15,$1b,$21,$12,$20,$10,$2a,$13
  .byte $1d,$16,$10,$1a,$21,$16,$22,$10,$21,$15,$10,$1c,$13,$19,$14,$01
  .byte $43,$46,$3d,$10,$47,$49,$3e,$41,$5a,$40,$45,$10,$3f,$3d,$10,$48
  .byte $3e,$3f,$3d,$3c,$45,$10,$4b,$51,$41,$5a,$40,$02,$15,$1b,$19,$10
  .byte $28,$13,$23,$2b,$10,$24,$1b,$21,$28,$19,$10,$21,$15,$10,$14,$15
  .byte $21,$28,$28,$10,$28,$19,$15,$14,$01,$4e,$46,$51,$45,$00

; DLG valv1
dlg_14:
  .byte $04,$18,$1d,$16,$20,$19,$10,$26,$1a,$28,$26,$19,$10,$13,$12,$19
  .byte $10,$19,$12,$20,$1a,$20,$19,$1c,$22,$01,$47,$46,$46,$4c,$3e,$43
  .byte $3d,$10,$3c,$47,$41,$40,$3e,$42,$3c,$10,$3d,$49,$41,$46,$51,$5a
  .byte $49,$10,$3d,$49,$40,$02,$28,$21,$12,$19,$22,$10,$5f,$69,$7c,$60
  .byte $69,$39,$5c,$69,$10,$7d,$10,$35,$7e,$10,$7f,$3b,$00

; DLG valv2
dlg_15:
  .byte $04,$18,$1d,$16,$20,$19,$10,$26,$1a,$28,$26,$19,$10,$15,$24,$13
  .byte $10,$19,$12,$20,$1a,$20,$19,$1c,$22,$10,$15,$1b,$19,$01,$3e,$3f
  .byte $41,$4c,$46,$47,$5b,$10,$4b,$4c,$3e,$3d,$40,$10,$4d,$41,$46,$3c
  .byte $3d,$3c,$10,$48,$49,$3f,$3d,$40,$45,$02,$5f,$69,$7c,$60,$69,$39
  .byte $5c,$69,$10,$80,$10,$35,$7e,$10,$7f,$3b,$00

; DLG valv3
dlg_16:
  .byte $04,$18,$1d,$16,$20,$19,$10,$26,$1a,$28,$26,$19,$10,$15,$1b,$16
  .byte $19,$19,$10,$19,$12,$20,$1a,$20,$19,$1c,$22,$01,$40,$42,$40,$41
  .byte $5a,$40,$43,$47,$4e,$10,$4b,$51,$41,$5a,$40,$10,$67,$62,$74,$55
  .byte $63,$59,$10,$3d,$49,$40,$02,$13,$1d,$15,$19,$16,$10,$1c,$13,$13
  .byte $16,$10,$21,$14,$10,$13,$12,$19,$10,$14,$15,$19,$18,$10,$1a,$24
  .byte $1a,$2a,$22,$01,$3c,$46,$10,$3f,$3c,$10,$3d,$49,$40,$10,$78,$46
  .byte $3f,$44,$45,$00

; DLG endLock
dlg_17:
  .byte $15,$1b,$19,$10,$1a,$21,$16,$28,$13,$23,$2b,$10,$14,$15,$1a,$2a
  .byte $14,$10,$14,$19,$1a,$28,$19,$1c,$22,$01,$3d,$49,$40,$10,$4b,$51
  .byte $41,$5a,$40,$10,$4c,$3f,$43,$40,$10,$3f,$3c,$10,$44,$40,$3e,$44
  .byte $10,$50,$10,$3d,$49,$40,$02,$26,$1a,$28,$26,$19,$14,$10,$17,$1d
  .byte $14,$15,$10,$25,$19,$10,$15,$1b,$16,$13,$24,$12,$10,$21,$12,$01
  .byte $3c,$40,$81,$51,$40,$43,$47,$40,$45,$10,$46,$43,$40,$10,$3d,$49
  .byte $40,$43,$10,$3d,$48,$46,$10,$3d,$49,$40,$43,$02,$15,$1b,$16,$19
  .byte $19,$2c,$10,$1a,$12,$1c,$10,$15,$1b,$19,$10,$13,$26,$19,$16,$16
  .byte $21,$1c,$19,$01,$4c,$46,$3e,$44,$40,$44,$45,$10,$3f,$3d,$10,$3f
  .byte $3c,$10,$3c,$3d,$3f,$4c,$4c,$10,$3f,$43,$10,$49,$40,$41,$40,$02
  .byte $24,$21,$15,$1b,$10,$2a,$13,$1d,$22,$00

; DLG endWin
dlg_18:
  .byte $03,$2a,$13,$1d,$10,$14,$28,$1a,$17,$10,$15,$1b,$19,$10,$19,$33
  .byte $19,$23,$15,$22,$10,$15,$1b,$19,$10,$28,$13,$23,$2b,$01,$52,$4c
  .byte $46,$48,$3c,$45,$10,$4d,$46,$41,$10,$46,$43,$40,$10,$49,$40,$3e
  .byte $41,$3d,$52,$40,$3e,$3d,$10,$3d,$49,$40,$02,$15,$1b,$21,$12,$20
  .byte $10,$21,$14,$10,$1a,$10,$25,$28,$1a,$23,$2b,$10,$14,$15,$1a,$16
  .byte $01,$3e,$5a,$3e,$3f,$43,$3c,$3d,$10,$3d,$49,$40,$10,$78,$46,$3f
  .byte $44,$45,$10,$3d,$49,$40,$43,$10,$3f,$3d,$10,$3f,$3c,$02,$12,$13
  .byte $15,$1b,$21,$12,$20,$2c,$10,$15,$1b,$19,$12,$10,$21,$15,$10,$21
  .byte $14,$10,$20,$13,$12,$19,$22,$01,$56,$64,$54,$67,$68,$10,$62,$55
  .byte $66,$53,$62,$57,$10,$53,$56,$10,$57,$71,$55,$02,$5c,$35,$37,$37
  .byte $69,$38,$5c,$3a,$5d,$6b,$10,$5f,$5e,$5d,$38,$5f,$6f,$3a,$82,$01
  .byte $54,$53,$65,$57,$62,$53,$74,$53,$59,$10,$57,$71,$64,$62,$63,$10
  .byte $53,$56,$56,$64,$61,$55,$62,$02,$38,$69,$82,$35,$38,$5e,$3a,$39
  .byte $34,$3b,$10,$5e,$6f,$69,$10,$35,$5e,$6f,$69,$38,$5f,$10,$5d,$38
  .byte $69,$01,$63,$55,$67,$63,$59,$10,$64,$10,$67,$74,$10,$65,$64,$6e
  .byte $54,$64,$54,$6e,$10,$53,$56,$56,$59,$02,$1a,$28,$13,$12,$19,$2c
  .byte $10,$2a,$13,$1d,$10,$14,$19,$15,$10,$23,$13,$1d,$16,$14,$19,$2c
  .byte $10,$1a,$12,$1c,$01,$3c,$4c,$40,$40,$4b,$45,$00

sfx_lo:
  .byte <sfx_0,<sfx_1,<sfx_2,<sfx_3,<sfx_4,<sfx_5

sfx_hi:
  .byte >sfx_0,>sfx_1,>sfx_2,>sfx_3,>sfx_4,>sfx_5

; sfx: walk
sfx_0:
  .byte $32,$ba,$0a,$02,$ff

; sfx: talk
sfx_1:
  .byte $b5,$fd,$08,$02,$b5,$a8,$08,$03,$ff

; sfx: pickup
sfx_2:
  .byte $b7,$d5,$08,$03,$b7,$a9,$08,$03,$b7,$8e,$08,$05,$ff

; sfx: exit
sfx_3:
  .byte $b6,$52,$09,$03,$b6,$aa,$09,$03,$b6,$1c,$09,$06,$ff

; sfx: ending
sfx_4:
  .byte $b7,$1c,$09,$06,$b7,$d5,$08,$06,$b7,$a9,$08,$06,$b7,$8e,$08,$0c
  .byte $ff

; sfx: type
sfx_5:
  .byte $b3,$5c,$08,$01,$ff

song_lo:
  .byte <song_0

song_hi:
  .byte >song_0

song_ord_lo:
  .byte <song_ord_0

song_ord_hi:
  .byte >song_ord_0

song_pat_lo:
  .byte <song_pat_0

song_pat_hi:
  .byte >song_pat_0

; SONG drone "nostromo drone"
song_0:
  .byte $11,$04,$04,$4e,$05,$fb,$c4,$ab,$7c,$52,$3f,$1c,$fd,$e1,$d5,$bd
  .byte $a9,$9f,$8e,$7e,$70,$09,$09,$09,$09,$09,$09,$09,$08,$08,$08,$08
  .byte $08,$08,$08,$08,$08,$f8,$89,$56,$f9,$a6,$80,$3a,$fb,$c4,$ab,$7c
  .byte $52,$3f,$1c,$fd,$e1,$0b,$0b,$0b,$0a,$0a,$0a,$0a,$09,$09,$09,$09
  .byte $09,$09,$09,$08,$08,$f1,$13,$ad,$f3,$4c,$00,$74,$f8,$89,$56,$f9
  .byte $a6,$80,$3a,$fb,$c4,$0f,$0f,$0e,$0d,$0d,$0d,$0c,$0b,$0b,$0b,$0a
  .byte $0a,$0a,$0a,$09,$09,$8e,$8d,$8c,$8b,$8a,$89,$88,$87,$86,$85,$84
  .byte $86,$83,$82,$81,$80

song_ord_0:
  .byte $00,$00,$01,$00

song_pat_0:
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$05,$00,$00,$00
  .byte $01,$00,$00,$00,$00,$00,$00,$00,$03,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$00,$00,$00,$00,$00,$00,$00,$01,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$0e,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$06,$00,$00,$00
  .byte $04,$00,$00,$00,$00,$00,$00,$00,$02,$00,$00,$00,$01,$00,$00,$00
  .byte $05,$00,$00,$00,$00,$00,$00,$00,$04,$00,$00,$00,$01,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$0e,$00,$00,$00,$00,$00,$00,$00

room_table:
  .word room_0,room_1,room_2,room_3,room_4

; ROOM 0 "hypersleep"
room_0:
  .byte $0f,$02,$12,$22,$0f,$0c,$1c,$3c,$0f,$00,$21,$30,$0f,$12,$2c,$30
  .byte $0f,$0f,$12,$30,$0f,$07,$28,$37,$0f,$0f,$03,$24,$0f,$06,$16,$30
  .byte $00,$00,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00
  .byte $00,$00,$01,$02,$02,$02,$02,$0c,$02,$02,$02,$02,$02,$01,$00,$00
  .byte $01,$01,$01,$06,$02,$02,$06,$02,$02,$06,$02,$02,$06,$01,$01,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$0f,$01
  .byte $01,$02,$06,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$06,$02,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$03
  .byte $01,$0f,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01
  .byte $01,$02,$0d,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$0d,$02,$01
  .byte $01,$01,$01,$02,$02,$0e,$02,$02,$02,$02,$0e,$02,$02,$01,$01,$01
  .byte $00,$00,$01,$02,$08,$02,$0a,$0a,$0a,$0a,$02,$08,$02,$01,$00,$00
  .byte $00,$00,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$40,$50,$90,$50,$50,$10,$00,$40,$58,$55,$56,$59,$55,$52,$10
  .byte $44,$65,$55,$55,$55,$55,$95,$10,$44,$55,$55,$55,$55,$55,$55,$d1
  .byte $40,$55,$55,$55,$55,$55,$55,$11,$04,$47,$d5,$55,$55,$75,$1d,$01
  .byte $00,$04,$05,$0f,$0f,$05,$01,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$7f,$01,$71,$ff,$ff,$03,$00,$01,$36,$00,$ff,$01,$67,$00,$00
  .byte $ff,$01,$97,$ff,$01,$00,$02,$01,$00,$00,$06,$00,$00,$00,$00

; ROOM 1 "corridor"
room_1:
  .byte $0f,$04,$14,$24,$0f,$0c,$1c,$3c,$0f,$00,$2a,$30,$0f,$14,$2c,$30
  .byte $0f,$0f,$12,$30,$0f,$07,$28,$37,$0f,$0f,$03,$24,$0f,$06,$16,$30
  .byte $00,$00,$00,$00,$00,$01,$01,$03,$01,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$0f,$02,$02,$02,$0f,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$01,$05,$01,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$01,$02,$01,$01,$02,$02,$02,$01,$01,$00,$00,$00,$00,$00
  .byte $01,$01,$0c,$02,$01,$02,$02,$02,$02,$02,$01,$01,$01,$01,$01,$01
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$0d,$02,$01
  .byte $03,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$03
  .byte $01,$02,$0d,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01
  .byte $01,$01,$01,$01,$01,$02,$02,$02,$02,$02,$01,$01,$02,$0c,$01,$01
  .byte $00,$00,$00,$00,$01,$01,$02,$02,$02,$01,$01,$01,$02,$01,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$0e,$02,$01,$00,$01,$05,$01,$00,$00
  .byte $00,$00,$00,$00,$00,$09,$02,$02,$02,$09,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$01,$03,$01,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$5c,$10,$00,$00,$00,$00,$80,$00,$55,$11,$00,$00,$00
  .byte $00,$64,$40,$55,$51,$00,$00,$00,$74,$55,$55,$55,$55,$55,$5d,$d1
  .byte $04,$07,$45,$55,$55,$05,$95,$01,$00,$00,$00,$d5,$11,$00,$21,$00
  .byte $00,$00,$04,$55,$15,$00,$00,$00,$00,$00,$00,$0c,$00,$00,$00,$00
  .byte $04,$70,$00,$7e,$ff,$ff,$11,$07,$02,$c7,$ff,$ff,$04,$7f,$03,$71
  .byte $ff,$ff,$05,$e7,$04,$17,$ff,$ff,$02,$00,$00,$00,$04,$43,$ff,$01
  .byte $01,$02,$05,$00,$01,$06,$03,$00,$ac,$ff,$01,$02,$02,$05,$00,$01
  .byte $06,$04,$00,$67,$01,$01,$03,$02,$01,$01,$00,$06,$05,$00,$97,$ff
  .byte $01,$04,$01,$06,$06,$00,$04,$07,$02,$04,$7f,$02,$04,$e7,$02,$04
  .byte $d7,$03,$04,$00

; ROOM 2 "bridge"
room_2:
  .byte $0f,$07,$17,$28,$0f,$00,$10,$2d,$0f,$00,$28,$37,$0f,$07,$28,$37
  .byte $0f,$0f,$12,$30,$0f,$07,$28,$37,$0f,$0f,$03,$24,$0f,$06,$16,$30
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00
  .byte $00,$01,$02,$05,$05,$0c,$0c,$05,$0c,$0c,$05,$05,$05,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$05,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$05,$01,$00
  .byte $00,$01,$0d,$08,$02,$02,$02,$02,$02,$02,$02,$02,$08,$0d,$01,$00
  .byte $00,$01,$01,$01,$01,$01,$02,$02,$02,$01,$01,$01,$01,$01,$01,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$0e,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$01,$01,$03,$01,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$59,$5a,$5a,$5a,$5a,$56,$00
  .byte $00,$65,$55,$55,$55,$55,$95,$00,$00,$07,$05,$55,$15,$05,$0d,$00
  .byte $00,$00,$00,$d5,$11,$00,$00,$00,$00,$00,$00,$55,$11,$00,$00,$00
  .byte $00,$00,$00,$c5,$01,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$d7,$01,$17,$ff,$ff,$03,$00,$01,$47,$01,$ff,$00,$01,$57,$00
  .byte $01,$05,$02,$01,$03,$00,$06,$09,$00,$00,$00

; ROOM 3 "mess"
room_3:
  .byte $0f,$09,$19,$29,$0f,$00,$10,$2d,$0f,$00,$1a,$2a,$0f,$06,$16,$30
  .byte $0f,$0f,$12,$30,$0f,$07,$28,$37,$0f,$0f,$03,$24,$0f,$06,$16,$30
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$02,$0c,$02,$02,$02,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$02,$02,$05,$02,$02,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$02,$0f,$02,$02,$02,$02,$07,$02,$01,$09,$01,$09,$01,$01,$00
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $03,$02,$02,$02,$02,$02,$02,$02,$02,$02,$0e,$02,$02,$02,$01,$00
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$08,$01,$00
  .byte $01,$02,$02,$02,$02,$02,$02,$02,$02,$01,$01,$01,$01,$01,$01,$00
  .byte $01,$02,$0d,$02,$02,$02,$02,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$02,$02,$02,$02,$02,$0d,$02,$02,$01,$00,$00,$00,$00,$00,$00
  .byte $01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00,$44,$96,$55,$55,$11,$00,$00,$00
  .byte $44,$45,$55,$95,$11,$10,$10,$00,$74,$55,$55,$55,$55,$75,$55,$00
  .byte $44,$55,$55,$55,$55,$55,$57,$00,$44,$75,$55,$55,$11,$00,$00,$00
  .byte $04,$05,$05,$07,$01,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$70,$01,$7e,$ff,$ff,$11,$00,$00,$01,$37,$01,$01,$ff,$02,$43
  .byte $ff,$01,$06,$03,$01,$02,$00,$01,$04,$00,$06,$0a,$00,$8a,$04,$01
  .byte $07,$01,$06,$0c,$00,$01,$8c,$04,$0b,$ff

; ROOM 4 "engineering"
room_4:
  .byte $0f,$06,$16,$26,$0f,$00,$10,$2d,$0f,$00,$27,$37,$0f,$16,$2c,$30
  .byte $0f,$0f,$12,$30,$0f,$07,$28,$37,$0f,$0f,$03,$24,$0f,$06,$16,$30
  .byte $00,$01,$01,$01,$01,$01,$01,$03,$01,$01,$01,$01,$01,$01,$01,$00
  .byte $00,$01,$0c,$02,$02,$09,$02,$02,$02,$02,$09,$02,$02,$0c,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$05,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$05,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$05,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00
  .byte $00,$01,$01,$01,$02,$01,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00
  .byte $00,$00,$00,$01,$02,$02,$02,$02,$02,$02,$02,$02,$01,$00,$00,$00
  .byte $00,$00,$00,$01,$01,$01,$01,$01,$01,$01,$01,$02,$01,$00,$00,$00
  .byte $00,$00,$00,$00,$0d,$02,$02,$0e,$02,$02,$02,$02,$0d,$00,$00,$00
  .byte $00,$00,$00,$00,$01,$02,$0a,$0a,$0a,$0a,$0a,$02,$01,$00,$00,$00
  .byte $00,$00,$00,$00,$01,$01,$01,$01,$01,$01,$01,$01,$01,$00,$00,$00
  .byte $00,$60,$50,$5c,$50,$50,$90,$00,$00,$55,$55,$55,$55,$55,$55,$00
  .byte $00,$56,$55,$55,$55,$55,$59,$00,$00,$55,$55,$59,$55,$55,$55,$00
  .byte $00,$05,$15,$05,$05,$05,$05,$00,$00,$00,$05,$05,$05,$45,$00,$00
  .byte $00,$00,$47,$fd,$f5,$75,$03,$00,$00,$00,$00,$00,$00,$00,$00,$00
  .byte $01,$07,$01,$d7,$ff,$ff,$03,$01,$d7,$12,$05,$11,$01,$cc,$02,$04
  .byte $00,$03,$52,$06,$00,$00,$02,$05,$01,$01,$06,$0e,$00,$5d,$07,$00
  .byte $00,$02,$05,$01,$01,$06,$0f,$00,$77,$08,$00,$00,$02,$05,$01,$01
  .byte $06,$10,$00,$02,$94,$09,$04,$bb,$0a,$04,$00

; conds, 3 bytes each: op, idx, value
cond_table:
  .byte $05,$02,$00
  .byte $07,$00,$02
  .byte $08,$00,$02
  .byte $02,$00,$01
  .byte $05,$04,$00
  .byte $07,$01,$03
  .byte $09,$01,$00
  .byte $09,$01,$01
  .byte $09,$01,$02
  .byte $02,$01,$01
  .byte $06,$03,$00

; variable initial values
var_init:
  .byte $00,$00,$00,$00,$00,$00,$00,$00


data_end:
.org $fffa
.word nmi, reset, irq
