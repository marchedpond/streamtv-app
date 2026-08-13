#---------------------------------------------------------------------------------
# StreamTV — Nintendo Switch (libnx / devkitA64) Makefile
#---------------------------------------------------------------------------------
ifeq ($(strip $(DEVKITPRO)),)
$(error "Please set DEVKITPRO in your environment. export DEVKITPRO=/opt/devkitpro")
endif

export TOPDIR   := $(CURDIR)

TARGET      := StreamTV
BUILD       := build
SOURCES     := source
INCLUDES    := include
DATA        := data

APP_TITLE   := StreamTV
APP_AUTHOR  := StreamTV Team
APP_VERSION := 1.0.0

PREFIX  := aarch64-none-elf-
CC      := $(DEVKITPRO)/devkitA64/bin/$(PREFIX)gcc
CXX     := $(DEVKITPRO)/devkitA64/bin/$(PREFIX)g++
LD      := $(DEVKITPRO)/devkitA64/bin/$(PREFIX)g++

ARCH        := -march=armv8-a+crc+crypto -mtune=cortex-a57 -mtp=soft -fPIE
CFLAGS      := -g -Wall -O2 -ffunction-sections $(ARCH) -D__SWITCH__ -I$(TOPDIR)/include -I$(PORTLIBS)/switch/include -I$(LIBNX)/include
CXXFLAGS    := $(CFLAGS) -std=gnu++17 -fno-rtti -fno-exceptions
LDFLAGS     := -specs=$(DEVKITPRO)/libnx/switch.specs -g $(ARCH) -Wl,-Map,$(notdir $(@:.elf=.map))

export LIBPATHS := -L$(PORTLIBS)/switch/lib -L$(LIBNX)/lib
export CC CXX LD PREFIX CFLAGS CXXFLAGS LDFLAGS LIBPATHS

ifneq ($(BUILD),$(notdir $(CURDIR)))

export OUTPUT   := $(CURDIR)/$(TARGET)
export VPATH    := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir))
export DEPSDIR  := $(CURDIR)/$(BUILD)

CFILES      := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.c)))
CPPFILES    := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.cpp)))

export OFILES   := $(CPPFILES:.cpp=.o) $(CFILES:.c=.o)
export LIBPATHS := $(foreach dir,$(LIBDIRS),-L$(dir)/lib)
export LIBS     := -lcurl -lmbedtls -lmbedcrypto -lmbedx509 -lz -lnx -lm

.PHONY: all clean

all: $(BUILD)
	@$(MAKE) --no-print-directory -C $(BUILD) -f $(TOPDIR)/Makefile TOPDIR=$(TOPDIR)

$(BUILD):
	@mkdir -p $@

clean:
	@echo "Limpiando archivos de compilacion..."
	@rm -rf $(BUILD) $(TARGET).elf $(TARGET).nro $(TARGET).nacp

else

include $(DEVKITPRO)/libnx/switch_rules

DEPENDS := $(OFILES:.o=.d)

all: $(OUTPUT).nro

$(OUTPUT).nro: $(OUTPUT).elf
$(OUTPUT).elf: $(OFILES)

-include $(DEPENDS)

endif
#---------------------------------------------------------------------------------
