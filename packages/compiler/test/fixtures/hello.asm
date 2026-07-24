; hello.asm — milestone 2 smoke ROM: prints HELLO WORLD, loops forever.
PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
PPUADDR   = $2006
PPUDATA   = $2007

reset:
  sei
  cld
  ldx #$40
  stx $4017          ; disable APU frame IRQ
  ldx #$ff
  txs
  inx                ; x = 0
  stx PPUCTRL        ; NMI off
  stx PPUMASK        ; rendering off
  stx $4010          ; DMC off
@wait1:
  bit PPUSTATUS
  bpl @wait1
@clrram:
  lda #0
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
@wait2:
  bit PPUSTATUS
  bpl @wait2

  ; palette: backdrop dark blue, text white
  lda PPUSTATUS
  lda #$3f
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldx #0
@pal:
  lda palette,x
  sta PPUDATA
  inx
  cpx #32
  bne @pal

  ; clear nametable 0 ($2000, 1024 bytes)
  lda PPUSTATUS
  lda #$20
  sta PPUADDR
  lda #$00
  sta PPUADDR
  ldx #4
  ldy #0
  lda #0
@clrnt:
  sta PPUDATA
  iny
  bne @clrnt
  dex
  bne @clrnt

  ; write message at row 14 col 10 → $2000 + 14*32 + 10 = $21ca
  lda PPUSTATUS
  lda #$21
  sta PPUADDR
  lda #$ca
  sta PPUADDR
  ldx #0
@msg:
  lda message,x
  beq @msgdone
  sec
  sbc #16            ; ascii → font tile: (c-32)+16 = c-16
  sta PPUDATA
  inx
  bne @msg
@msgdone:

  ; reset scroll, enable BG
  lda PPUSTATUS
  lda #0
  sta $2005
  sta $2005
  lda #%00000000
  sta PPUCTRL
  lda #%00001010     ; show BG + left column
  sta PPUMASK
forever:
  jmp forever

nmi:
irq:
  rti

palette:
  .byte $0f,$30,$30,$30, $0f,$30,$30,$30, $0f,$30,$30,$30, $0f,$30,$30,$30
  .byte $0f,$30,$30,$30, $0f,$30,$30,$30, $0f,$30,$30,$30, $0f,$30,$30,$30

message:
  .byte "HELLO WORLD", 0

.org $fffa
.word nmi, reset, irq
