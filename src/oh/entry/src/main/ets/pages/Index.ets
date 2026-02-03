/**
 * Minimal page for CRAFT ability.
 * Stage 1 has no UI - this is just required by UIAbility.
 */

@Entry
@Component
struct Index {
    @State message: string = 'CRAFT Parser - Stage 1'
    @State status: string = 'Check hilog for parsing output'

    build() {
        Column() {
            Text(this.message)
                .fontSize(24)
                .fontWeight(FontWeight.Bold)
                .margin({ top: 100 })

            Text(this.status)
                .fontSize(16)
                .margin({ top: 20 })
                .fontColor('#666666')

            Text('Launch with:')
                .fontSize(14)
                .margin({ top: 40 })
                .fontColor('#999999')

            Text('hdc shell aa start -a EntryAbility -b com.craft.parser --ps apk_path /path/to/app.apk')
                .fontSize(12)
                .margin({ top: 10 })
                .fontColor('#999999')
                .textAlign(TextAlign.Center)
                .padding({ left: 20, right: 20 })
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Start)
        .alignItems(HorizontalAlign.Center)
    }
}
